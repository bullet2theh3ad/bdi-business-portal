# Amazon SP-API TypeScript Client

Complete TypeScript implementation of Amazon Selling Partner API, ported from the working Python implementation in BDI_2.

## 🎯 Features

- ✅ **LWA Authentication** - Login with Amazon token management
- ✅ **AWS SigV4 Signing** - Proper request signing for SP-API
- ✅ **Reports API** - 3-step report workflow (Request → Wait → Download)
- ✅ **Financial Events API** - Transaction-level detail with pagination
- ✅ **Rate Limiting** - Exponential backoff with jitter
- ✅ **Request Queue** - Concurrent request management
- ✅ **TypeScript Types** - Complete type definitions
- ✅ **Error Handling** - Comprehensive error types and retry logic

## 📦 Installation

```bash
# Already included in the project
# No additional dependencies needed beyond existing Next.js setup
```

## 🔧 Configuration

### Environment Variables

Add to your `.env.local`:

```bash
# Amazon SP-API Credentials
AMAZON_CLIENT_ID=amzn1.application-oa2-client.xxxxx
AMAZON_CLIENT_SECRET=amzn1.oa2-cs.v1.xxxxx
AMAZON_REFRESH_TOKEN=Atzr|xxxxx

# AWS IAM Credentials (for request signing)
AMAZON_ACCESS_KEY=AKIAxxxxx
AMAZON_SECRET_KEY=xxxxx

# Optional
AMAZON_REGION=us-east-1
AMAZON_SELLER_ID=xxxxx
```

### Getting Credentials

1. **SP-API Credentials** (Client ID, Secret, Refresh Token):
   - Register as Amazon SP-API developer
   - Create an app in Seller Central
   - Generate LWA credentials

2. **AWS IAM Credentials** (Access Key, Secret Key):
   - Create IAM user in AWS Console
   - Attach policy: `AmazonSellingPartnerAPIFullAccess`
   - Generate access keys

## 🚀 Usage

### Basic Setup

```typescript
import { AmazonSPAPIService } from '@/lib/services/amazon-sp-api';
import { getAmazonCredentials } from '@/lib/services/amazon-sp-api/config';

// Initialize the service
const credentials = getAmazonCredentials();
const amazon = new AmazonSPAPIService(credentials);
```

### Get Settlement Report

```typescript
// Get settlement report for January 2025
const settlementData = await amazon.getSettlementReport(
  '2025-01-01',
  '2025-01-31'
);

// Parse TSV data
const lines = settlementData.split('\n');
const headers = lines[0].split('\t');
const rows = lines.slice(1).map(line => line.split('\t'));

console.log(`Retrieved ${rows.length} settlement records`);
```

### Get Financial Transactions

```typescript
// Get detailed transaction data
const transactions = await amazon.getFinancialTransactions(
  '2025-01-01',
  '2025-01-31'
);

// Parse transactions
import { FinancialEventsParser } from '@/lib/services/amazon-sp-api';

const orderIds = FinancialEventsParser.extractOrderIds(transactions);
const totalRevenue = FinancialEventsParser.calculateTotalRevenue(transactions);
const totalFees = FinancialEventsParser.calculateTotalFees(transactions);
const skuSummary = FinancialEventsParser.getSKUSummary(transactions);

console.log(`Orders: ${orderIds.length}`);
console.log(`Revenue: $${totalRevenue.toFixed(2)}`);
console.log(`Fees: $${totalFees.toFixed(2)}`);
console.log(`SKUs: ${skuSummary.size}`);
```

### Get Monthly Transactions

```typescript
// Get current month transactions
const currentMonth = await amazon.getCurrentMonthFinancialTransactions();

// Get specific month
const january = await amazon.getMonthlyFinancialTransactions(2025, 1);
```

### Get Inventory Report

```typescript
const inventoryData = await amazon.getInventoryReport();
```

### Get Returns Report

```typescript
const returnsData = await amazon.getReturnsReport(
  '2025-01-01',
  '2025-01-31'
);
```

### Large Date Ranges (Chunked)

```typescript
// Automatically chunks into 30-day periods
const transactions = await amazon.getFinancialTransactionsChunked(
  '2024-01-01',
  '2024-12-31',
  30 // chunk size in days
);
```

## 📊 Report Types

### Available Reports

```typescript
import { AmazonReportType } from '@/lib/services/amazon-sp-api';

// Settlement Reports
AmazonReportType.SETTLEMENT_V2
AmazonReportType.SETTLEMENT

// Order Reports
AmazonReportType.FLAT_FILE_ORDERS
AmazonReportType.FLAT_FILE_ORDERS_V2

// Inventory Reports
AmazonReportType.INVENTORY_LEDGER
AmazonReportType.FBA_INVENTORY
AmazonReportType.STRANDED_INVENTORY

// Returns Reports
AmazonReportType.FBA_RETURNS
AmazonReportType.FLAT_FILE_RETURNS

// Fee Reports
AmazonReportType.FBA_ESTIMATED_FEES
AmazonReportType.FBA_REIMBURSEMENTS

// Listing Reports
AmazonReportType.ACTIVE_LISTINGS
AmazonReportType.OPEN_LISTINGS
```

### Custom Reports

```typescript
const customReport = await amazon.getCustomReport(
  'GET_MERCHANT_LISTINGS_DATA',
  undefined, // no start date
  undefined, // no end date
  [AmazonMarketplace.US]
);
```

## 🌍 Marketplaces

```typescript
import { AmazonMarketplace } from '@/lib/services/amazon-sp-api';

// North America
AmazonMarketplace.US    // United States
AmazonMarketplace.CA    // Canada
AmazonMarketplace.MX    // Mexico
AmazonMarketplace.BR    // Brazil

// Europe
AmazonMarketplace.UK    // United Kingdom
AmazonMarketplace.DE    // Germany
AmazonMarketplace.FR    // France
AmazonMarketplace.IT    // Italy
AmazonMarketplace.ES    // Spain
AmazonMarketplace.NL    // Netherlands
AmazonMarketplace.SE    // Sweden
AmazonMarketplace.PL    // Poland

// Asia Pacific
AmazonMarketplace.JP    // Japan
AmazonMarketplace.AU    // Australia
AmazonMarketplace.SG    // Singapore
AmazonMarketplace.AE    // UAE
AmazonMarketplace.IN    // India
```

## 🔄 API Endpoints

### Create API Route

```typescript
// app/api/amazon/transactions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AmazonSPAPIService } from '@/lib/services/amazon-sp-api';
import { getAmazonCredentials } from '@/lib/services/amazon-sp-api/config';

export async function POST(request: NextRequest) {
  try {
    const { startDate, endDate } = await request.json();
    
    const credentials = getAmazonCredentials();
    const amazon = new AmazonSPAPIService(credentials);
    
    const transactions = await amazon.getFinancialTransactions(
      startDate,
      endDate
    );
    
    return NextResponse.json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    console.error('Amazon API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

## 🗄️ Database Storage

### Store Transaction Data

```typescript
import { db } from '@/lib/db';
import { amazonTransactions } from '@/lib/db/schema';

// Get transactions
const transactions = await amazon.getFinancialTransactions(
  '2025-01-01',
  '2025-01-31'
);

// Store in database
for (const eventGroup of transactions) {
  for (const shipment of eventGroup.ShipmentEventList || []) {
    await db.insert(amazonTransactions).values({
      orderId: shipment.AmazonOrderId,
      postedDate: shipment.PostedDate,
      marketplace: shipment.MarketplaceName,
      rawData: shipment, // Store full JSON
      createdAt: new Date(),
    });
  }
}
```

## ⚡ Performance

### Rate Limiting

The client automatically handles:
- Exponential backoff on rate limit errors
- Jitter to avoid thundering herd
- Configurable retry attempts
- Request queuing for concurrent requests

### Pagination

Financial Events API automatically handles pagination:
- Fetches all pages using `nextToken`
- No manual pagination needed
- Handles large datasets efficiently

### Caching

LWA tokens are cached automatically:
- Tokens cached until 5 minutes before expiry
- Automatic refresh when needed
- No manual token management required

## 🐛 Error Handling

```typescript
import { AmazonSPAPIError } from '@/lib/services/amazon-sp-api';

try {
  const data = await amazon.getSettlementReport('2025-01-01', '2025-01-31');
} catch (error) {
  if (error instanceof AmazonSPAPIError) {
    console.error('Amazon API Error:', {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      details: error.details,
    });
    
    // Handle specific errors
    switch (error.code) {
      case 'QuotaExceeded':
        // Rate limit hit
        break;
      case 'REPORT_TIMEOUT':
        // Report took too long
        break;
      case 'LWA_TOKEN_ERROR':
        // Authentication failed
        break;
    }
  }
}
```

## 📝 Best Practices

### 1. Use Financial Events API for Transaction Detail

```typescript
// ✅ Best for transaction-level detail
const transactions = await amazon.getFinancialTransactions(
  startDate,
  endDate
);
```

### 2. Use Settlement Reports for Bank Reconciliation

```typescript
// ✅ Best for matching bank deposits
const settlement = await amazon.getSettlementReport(
  startDate,
  endDate
);
```

### 3. Chunk Large Date Ranges

```typescript
// ✅ Avoid timeouts with chunking
const transactions = await amazon.getFinancialTransactionsChunked(
  '2024-01-01',
  '2024-12-31',
  30 // 30-day chunks
);
```

### 4. Store Raw Data

```typescript
// ✅ Store raw JSON for future parsing
await db.insert(amazonData).values({
  reportType: 'financial_events',
  dateRange: { start: startDate, end: endDate },
  rawData: transactions, // Full JSON
  createdAt: new Date(),
});
```

### 5. Handle Rate Limits Gracefully

```typescript
// ✅ Client handles this automatically
// But you can customize retry behavior
const amazon = new AmazonSPAPIService(credentials);
// Rate limiting is built-in with exponential backoff
```

## 🔍 Debugging

### Check Configuration

```typescript
import { getConfigStatus } from '@/lib/services/amazon-sp-api/config';

const status = getConfigStatus();
console.log('Amazon SP-API configured:', status.configured);
if (!status.configured) {
  console.log('Missing fields:', status.missingFields);
}
```

### Clear Token Cache

```typescript
// Force token refresh
amazon.clearAuthCache();
```

### Check Queue Status

```typescript
const queueStatus = amazon.getQueueStatus();
console.log('Queued requests:', queueStatus.queued);
console.log('Running requests:', queueStatus.running);
```

## 📚 References

- [Amazon SP-API Documentation](https://developer-docs.amazon.com/sp-api/)
- [Financial Events API](https://developer-docs.amazon.com/sp-api/docs/finances-api-v2024-06-19-reference)
- [Reports API](https://developer-docs.amazon.com/sp-api/docs/reports-api-v2021-06-30-reference)

## 🎓 Based On

This TypeScript implementation is a direct port of the working Python implementation in `BDI_2`:
- `amazon_finances_API.py` → `financial-events.ts`
- `aws_client.py` → `client.ts` + `auth.ts`
- `fetch_settlement_reports.py` → `client.ts`
- `config_aws.py` → `config.ts`

All proven patterns and logic from the Python version have been preserved.
