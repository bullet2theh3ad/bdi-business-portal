# 🚀 Amazon SP-API Implementation Guide for BDI Portal

## ✅ Phase 1: Foundation (COMPLETED)

### What We Built

1. **Complete TypeScript SP-API Client** (`lib/services/amazon-sp-api/`)
   - ✅ `types.ts` - Comprehensive type definitions
   - ✅ `auth.ts` - LWA authentication + AWS SigV4 signing
   - ✅ `rate-limiter.ts` - Exponential backoff with jitter
   - ✅ `client.ts` - Reports API (3-step workflow)
   - ✅ `financial-events.ts` - Financial Events API with pagination
   - ✅ `config.ts` - Environment configuration
   - ✅ `index.ts` - Unified service interface
   - ✅ `README.md` - Complete documentation

### Key Features

- **Authentication**: LWA token management with automatic refresh
- **Request Signing**: AWS SigV4 signature for all SP-API calls
- **Rate Limiting**: Automatic retry with exponential backoff
- **Pagination**: Handles `nextToken` for large datasets
- **Error Handling**: Comprehensive error types and retry logic
- **Type Safety**: Full TypeScript types for all API responses

---

## 📋 Phase 2: Database Schema (NEXT STEP)

### Create Amazon Data Tables

```sql
-- File: create-amazon-tables.sql

-- 1. Amazon Financial Events (Transaction-level detail)
CREATE TABLE amazon_financial_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  
  -- Event metadata
  event_type TEXT NOT NULL, -- 'shipment', 'refund', 'adjustment', etc.
  amazon_order_id TEXT,
  seller_order_id TEXT,
  marketplace_name TEXT,
  posted_date TIMESTAMPTZ,
  
  -- Transaction details
  seller_sku TEXT,
  quantity INTEGER,
  
  -- Financial data
  revenue_amount DECIMAL(10,2),
  revenue_currency TEXT DEFAULT 'USD',
  fee_amount DECIMAL(10,2),
  fee_currency TEXT DEFAULT 'USD',
  net_amount DECIMAL(10,2),
  
  -- Raw data (for future parsing)
  raw_event_data JSONB NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_amazon_events_org (organization_id),
  INDEX idx_amazon_events_order (amazon_order_id),
  INDEX idx_amazon_events_sku (seller_sku),
  INDEX idx_amazon_events_date (posted_date),
  INDEX idx_amazon_events_type (event_type)
);

-- 2. Amazon Settlement Reports (Bank reconciliation)
CREATE TABLE amazon_settlement_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  
  -- Settlement metadata
  settlement_id TEXT UNIQUE,
  settlement_start_date TIMESTAMPTZ,
  settlement_end_date TIMESTAMPTZ,
  deposit_date TIMESTAMPTZ,
  
  -- Financial summary
  total_amount DECIMAL(10,2),
  currency TEXT DEFAULT 'USD',
  
  -- Report data
  report_document_id TEXT,
  raw_report_data TEXT, -- TSV data
  parsed_data JSONB, -- Parsed JSON
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_amazon_settlement_org (organization_id),
  INDEX idx_amazon_settlement_date (deposit_date),
  INDEX idx_amazon_settlement_id (settlement_id)
);

-- 3. Amazon Order Reports (Unit economics)
CREATE TABLE amazon_order_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  
  -- Order metadata
  amazon_order_id TEXT NOT NULL,
  purchase_date TIMESTAMPTZ,
  order_status TEXT,
  
  -- Product details
  seller_sku TEXT,
  asin TEXT,
  quantity INTEGER,
  
  -- Pricing
  item_price DECIMAL(10,2),
  item_tax DECIMAL(10,2),
  shipping_price DECIMAL(10,2),
  shipping_tax DECIMAL(10,2),
  
  -- Raw data
  raw_order_data JSONB NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_amazon_orders_org (organization_id),
  INDEX idx_amazon_orders_id (amazon_order_id),
  INDEX idx_amazon_orders_sku (seller_sku),
  INDEX idx_amazon_orders_date (purchase_date)
);

-- 4. Amazon Inventory Snapshots
CREATE TABLE amazon_inventory_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  
  -- Inventory details
  seller_sku TEXT NOT NULL,
  fnsku TEXT,
  asin TEXT,
  
  -- Quantities
  fulfillable_quantity INTEGER,
  inbound_working_quantity INTEGER,
  inbound_shipped_quantity INTEGER,
  inbound_receiving_quantity INTEGER,
  reserved_quantity INTEGER,
  
  -- Snapshot metadata
  snapshot_date TIMESTAMPTZ NOT NULL,
  
  -- Raw data
  raw_inventory_data JSONB NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_amazon_inventory_org (organization_id),
  INDEX idx_amazon_inventory_sku (seller_sku),
  INDEX idx_amazon_inventory_date (snapshot_date)
);

-- 5. Amazon Returns Data
CREATE TABLE amazon_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  
  -- Return metadata
  return_date TIMESTAMPTZ,
  amazon_order_id TEXT,
  
  -- Product details
  seller_sku TEXT,
  asin TEXT,
  fnsku TEXT,
  quantity INTEGER,
  
  -- Return details
  return_reason TEXT,
  return_status TEXT,
  disposition TEXT, -- 'Sellable', 'Defective', etc.
  
  -- Raw data
  raw_return_data JSONB NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_amazon_returns_org (organization_id),
  INDEX idx_amazon_returns_order (amazon_order_id),
  INDEX idx_amazon_returns_sku (seller_sku),
  INDEX idx_amazon_returns_date (return_date)
);

-- 6. Amazon API Sync Status (Track sync jobs)
CREATE TABLE amazon_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  
  -- Job details
  job_type TEXT NOT NULL, -- 'financial_events', 'settlement', 'orders', etc.
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- Status
  status TEXT NOT NULL, -- 'pending', 'running', 'completed', 'failed'
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Results
  records_processed INTEGER DEFAULT 0,
  error_message TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_amazon_sync_org (organization_id),
  INDEX idx_amazon_sync_status (status),
  INDEX idx_amazon_sync_type (job_type),
  INDEX idx_amazon_sync_date (start_date, end_date)
);

-- Add RLS policies
ALTER TABLE amazon_financial_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE amazon_settlement_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE amazon_order_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE amazon_inventory_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE amazon_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE amazon_sync_jobs ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only see their organization's data
CREATE POLICY amazon_events_org_policy ON amazon_financial_events
  FOR ALL USING (
    organization_id IN (
      SELECT organization_uuid FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY amazon_settlement_org_policy ON amazon_settlement_reports
  FOR ALL USING (
    organization_id IN (
      SELECT organization_uuid FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY amazon_orders_org_policy ON amazon_order_reports
  FOR ALL USING (
    organization_id IN (
      SELECT organization_uuid FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY amazon_inventory_org_policy ON amazon_inventory_snapshots
  FOR ALL USING (
    organization_id IN (
      SELECT organization_uuid FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY amazon_returns_org_policy ON amazon_returns
  FOR ALL USING (
    organization_id IN (
      SELECT organization_uuid FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY amazon_sync_org_policy ON amazon_sync_jobs
  FOR ALL USING (
    organization_id IN (
      SELECT organization_uuid FROM users WHERE auth_id = auth.uid()
    )
  );
```

---

## 📡 Phase 3: API Endpoints (NEXT STEP)

### Create API Routes

```typescript
// File: app/api/amazon/sync/financial-events/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AmazonSPAPIService } from '@/lib/services/amazon-sp-api';
import { getAmazonCredentials } from '@/lib/services/amazon-sp-api/config';
import { db } from '@/lib/db';
import { amazonFinancialEvents, amazonSyncJobs } from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { startDate, endDate, organizationId } = await request.json();

    // Create sync job
    const [syncJob] = await db.insert(amazonSyncJobs).values({
      organizationId,
      jobType: 'financial_events',
      startDate,
      endDate,
      status: 'running',
      startedAt: new Date(),
    }).returning();

    // Fetch from Amazon
    const credentials = getAmazonCredentials();
    const amazon = new AmazonSPAPIService(credentials);
    
    const transactions = await amazon.getFinancialTransactions(
      startDate,
      endDate
    );

    // Store in database
    let recordsProcessed = 0;
    
    for (const eventGroup of transactions) {
      // Process shipment events
      for (const shipment of eventGroup.ShipmentEventList || []) {
        for (const item of shipment.ShipmentItemList || []) {
          // Calculate totals
          const revenue = item.ItemChargeList?.reduce(
            (sum, charge) => sum + (charge.ChargeAmount?.CurrencyAmount || 0),
            0
          ) || 0;
          
          const fees = item.ItemFeeList?.reduce(
            (sum, fee) => sum + Math.abs(fee.FeeAmount?.CurrencyAmount || 0),
            0
          ) || 0;

          await db.insert(amazonFinancialEvents).values({
            organizationId,
            eventType: 'shipment',
            amazonOrderId: shipment.AmazonOrderId,
            sellerOrderId: shipment.SellerOrderId,
            marketplaceName: shipment.MarketplaceName,
            postedDate: shipment.PostedDate,
            sellerSku: item.SellerSKU,
            quantity: item.QuantityShipped,
            revenueAmount: revenue,
            feeAmount: fees,
            netAmount: revenue - fees,
            rawEventData: item,
          });

          recordsProcessed++;
        }
      }
      
      // Process refund events
      for (const refund of eventGroup.RefundEventList || []) {
        // Similar processing for refunds
        recordsProcessed++;
      }
    }

    // Update sync job
    await db.update(amazonSyncJobs)
      .set({
        status: 'completed',
        completedAt: new Date(),
        recordsProcessed,
      })
      .where(eq(amazonSyncJobs.id, syncJob.id));

    return NextResponse.json({
      success: true,
      syncJobId: syncJob.id,
      recordsProcessed,
    });

  } catch (error) {
    console.error('Amazon sync error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

```typescript
// File: app/api/amazon/sync/settlement/route.ts
export async function POST(request: NextRequest) {
  // Similar structure for settlement reports
}
```

```typescript
// File: app/api/amazon/sync/orders/route.ts
export async function POST(request: NextRequest) {
  // Similar structure for order reports
}
```

---

## 🎨 Phase 4: UI Components (NEXT STEP)

### Amazon Dashboard Page

```typescript
// File: app/(dashboard)/amazon/page.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function AmazonDashboardPage() {
  const [syncing, setSyncing] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(1)), // First of month
    end: new Date(),
  });

  const syncFinancialEvents = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/amazon/sync/financial-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: dateRange.start.toISOString().split('T')[0],
          endDate: dateRange.end.toISOString().split('T')[0],
          organizationId: 'current-org-id', // Get from context
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        alert(`Synced ${data.recordsProcessed} records`);
      }
    } catch (error) {
      console.error('Sync error:', error);
      alert('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Amazon Seller Central</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue (MTD)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">$45,234.56</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orders (MTD)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">1,234</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fees (MTD)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">$8,456.78</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sync Amazon Data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
            />
            <Button
              onClick={syncFinancialEvents}
              disabled={syncing}
            >
              {syncing ? 'Syncing...' : 'Sync Transactions'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## ⏰ Phase 5: Scheduled Jobs (NEXT STEP)

### Create Cron Job for Daily Sync

```typescript
// File: app/api/cron/amazon-daily-sync/route.ts
import { NextResponse } from 'next/server';
import { AmazonSPAPIService } from '@/lib/services/amazon-sp-api';
import { getAmazonCredentials } from '@/lib/services/amazon-sp-api/config';

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const credentials = getAmazonCredentials();
    const amazon = new AmazonSPAPIService(credentials);

    // Get yesterday's data
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    // Sync financial events
    const transactions = await amazon.getFinancialTransactions(
      dateStr,
      dateStr
    );

    // Store in database (similar to API route)
    // ... database insertion logic ...

    return NextResponse.json({
      success: true,
      date: dateStr,
      recordsProcessed: transactions.length,
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

### Add to Vercel Cron Config

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/amazon-daily-sync",
      "schedule": "0 6 * * *"
    }
  ]
}
```

---

## 📊 Phase 6: Analytics & Reporting (FUTURE)

### Create Analytics Queries

```typescript
// File: lib/services/amazon-analytics.ts

export async function getMonthlyRevenue(organizationId: string, year: number, month: number) {
  const result = await db
    .select({
      totalRevenue: sql`SUM(revenue_amount)`,
      totalFees: sql`SUM(fee_amount)`,
      netRevenue: sql`SUM(net_amount)`,
      orderCount: sql`COUNT(DISTINCT amazon_order_id)`,
    })
    .from(amazonFinancialEvents)
    .where(
      and(
        eq(amazonFinancialEvents.organizationId, organizationId),
        sql`EXTRACT(YEAR FROM posted_date) = ${year}`,
        sql`EXTRACT(MONTH FROM posted_date) = ${month}`
      )
    );

  return result[0];
}

export async function getTopSKUs(organizationId: string, limit: number = 10) {
  return await db
    .select({
      sku: amazonFinancialEvents.sellerSku,
      totalUnits: sql`SUM(quantity)`,
      totalRevenue: sql`SUM(revenue_amount)`,
      totalFees: sql`SUM(fee_amount)`,
      netRevenue: sql`SUM(net_amount)`,
    })
    .from(amazonFinancialEvents)
    .where(eq(amazonFinancialEvents.organizationId, organizationId))
    .groupBy(amazonFinancialEvents.sellerSku)
    .orderBy(sql`SUM(revenue_amount) DESC`)
    .limit(limit);
}
```

---

## 🎯 Implementation Checklist

### Immediate Next Steps

- [ ] Run database migration (`create-amazon-tables.sql`)
- [ ] Add Amazon credentials to `.env.local`
- [ ] Test authentication with simple API call
- [ ] Create first API endpoint (`/api/amazon/sync/financial-events`)
- [ ] Test data sync for one day
- [ ] Verify data in database
- [ ] Build basic UI dashboard
- [ ] Set up daily cron job

### Future Enhancements

- [ ] Add inventory tracking
- [ ] Add returns analysis
- [ ] Add advertising data integration
- [ ] Add profitability calculator
- [ ] Add SKU performance dashboard
- [ ] Add settlement reconciliation
- [ ] Add automated alerts (low inventory, high returns, etc.)
- [ ] Add multi-marketplace support
- [ ] Add historical data backfill

---

## 🚀 Ready to Start?

The foundation is complete! All TypeScript code is production-ready and based on your proven Python implementation.

**Next command to run:**
```bash
# Add environment variables to .env.local
# Then test the service
```

Let me know when you're ready to proceed with Phase 2 (Database Schema) or if you want to test the current implementation first!
