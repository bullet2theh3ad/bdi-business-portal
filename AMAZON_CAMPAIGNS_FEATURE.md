# Amazon Campaign Analytics Feature

## Overview
This feature allows you to upload and analyze Amazon Sponsored Products campaign data from the Amazon Advertising Console.

## What It Does

### 1. **Campaign Data Upload**
- Upload CSV files exported from Amazon Advertising Console
- Automatically parses campaign performance data
- Extracts SKU information from campaign names
- Stores historical campaign data for analysis

### 2. **Campaign Analytics Dashboard**
- **Summary Cards**: Total Ad Spend, Total Sales, Avg ACOS, Avg ROAS
- **SKU Performance Chart**: Visual bar chart showing ad spend vs sales by SKU
- **Detailed SKU Table**: Complete breakdown of metrics per SKU including:
  - Number of campaigns
  - Ad spend
  - Sales generated
  - Orders
  - ACOS (Advertising Cost of Sales)
  - ROAS (Return on Ad Spend)
  - CTR (Click-Through Rate)

### 3. **SKU Extraction Logic**
The system automatically extracts SKU codes from campaign names using the pattern:
- `SP | MQ20 | Category Extended` → **MQ20**
- `SP | MG8702 | Auto` → **MG8702**
- `SP | B12 | Kw Target` → **B12**
- `SP | MB8611 | Branded` → **MB8611**

## How to Use

### Step 1: Download Campaign Data from Amazon
1. Go to **Amazon Advertising Console**
2. Navigate to **Campaign Manager**
3. Select your campaigns (or select all)
4. Click **Download** → **Campaign report (CSV)**
5. Save the CSV file

### Step 2: Upload to BDI Portal
1. Log in to BDI Business Portal
2. Navigate to **Amazon Data** → **Campaign Analytics**
3. Click **Choose File** and select your downloaded CSV
4. The system will automatically:
   - Parse the CSV data
   - Extract SKU information
   - Calculate aggregated metrics
   - Display analytics dashboard

### Step 3: Analyze Performance
- View total ad spend and sales across all campaigns
- Identify top-performing SKUs
- Monitor ACOS and ROAS metrics
- Compare campaign efficiency across products

## Database Schema

### Tables Created
1. **`amazon_campaign_uploads`** - Tracks each CSV file upload
2. **`amazon_campaign_data`** - Stores detailed campaign metrics

### Key Metrics Stored
- Campaign identification (name, SKU, country, status)
- Performance metrics (impressions, clicks, CTR)
- Spend metrics (ad spend, CPC)
- Conversion metrics (orders, sales)
- Efficiency metrics (ACOS, ROAS)
- New-to-Brand metrics
- Long-term sales data

## API Endpoints

### Upload Campaign Data
```
POST /api/amazon/campaigns/upload
```
Accepts CSV file and parses campaign data.

### Get Campaign Summary
```
GET /api/amazon/campaigns/summary
```
Returns aggregated metrics by SKU.

Optional query parameters:
- `sku` - Filter by specific SKU
- `country` - Filter by country (United States, Canada)
- `uploadId` - Filter by specific upload batch

## Access Control
- **Restricted to**: Super Admin and CFO roles
- **BDI-only feature**: Not visible to partner organizations

## Future Enhancements
1. **Integration with Financial Data**: Link ad spend to SKU profitability analysis
2. **Time-Series Analysis**: Track campaign performance over time
3. **Campaign Comparison**: Compare different campaign strategies
4. **Automated Recommendations**: AI-powered suggestions for budget optimization
5. **Export Functionality**: Download analyzed data as Excel reports
6. **Budget Alerts**: Notifications when campaigns exceed budget thresholds

## Technical Details

### CSV Parsing
- Handles quoted fields with commas
- Converts currency strings to numeric values
- Parses percentage values
- Extracts date ranges from campaign data

### Data Processing
- Batch inserts for performance (100 records per batch)
- Automatic SKU extraction using regex pattern matching
- Aggregation of metrics by SKU
- Calculation of derived metrics (ACOS, ROAS, CTR)

### Error Handling
- Validates CSV structure
- Handles missing or malformed data
- Provides detailed error messages
- Tracks upload status (processing, completed, failed)

## Example Campaign Data
Your uploaded file (`Campaign_Oct_19_2025.csv`) contains:
- **41 campaigns** across multiple SKUs
- **SKUs identified**: MQ20, MG8702, B12, MB8611, MT7711, MG7700
- **Countries**: United States, Canada
- **Campaign types**: Sponsored Products (SP)
- **Targeting**: Manual and Automatic

## Support
For questions or issues, contact the BDI development team.

