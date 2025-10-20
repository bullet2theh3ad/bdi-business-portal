# Sales Velocity Redesign - Baby Steps Implementation

## Overview
Completely redesigned Sales Velocity to use **database data only** with three debug cards showing real-time inventory and sales metrics.

## New Structure

### 1. **Amazon FBA Inventory Card** (Blue)
- **Data Source:** `amazon_inventory_snapshots` table
- **API:** `/api/sales-velocity/amazon-inventory`
- **Metrics:**
  - Total SKUs
  - Total Units
  - Last Sync Date
- **Expandable Details:** SKU, ASIN, FNSKU, Condition, Quantity

### 2. **EMG Warehouse Card** (Green)
- **Data Source:** EMG inventory reports (placeholder for now)
- **API:** `/api/sales-velocity/warehouse-inventory?warehouse=EMG`
- **Metrics:**
  - Total SKUs
  - Total Units
  - Total Value (units × standard_cost from product_skus)
- **Expandable Details:** SKU, Units, Std Cost, Total Value

### 3. **CATV Warehouse Card** (Orange)
- **Data Source:** `warehouse_wip_units` table (Active WIP only, where wip=1)
- **API:** `/api/sales-velocity/warehouse-inventory?warehouse=CATV`
- **Metrics:**
  - Total SKUs
  - Total Units (unique serial numbers)
  - Total Value (units × standard_cost from product_skus)
- **Expandable Details:** SKU, Units, Std Cost, Total Value

### 4. **Sales Velocity Card** (Purple)
- **Data Source:** `amazon_financial_line_items` table
- **API:** `/api/sales-velocity/calculate-from-db`
- **Calculation:**
  - Aggregates all orders by BDI SKU
  - Calculates total sales, revenue, first/last sale dates
  - Computes daily velocity: `totalSales / daysInPeriod`
- **Metrics:**
  - Total SKUs
  - Total Sales (units)
  - Total Revenue
- **Expandable Details:** SKU, Total Sales, Revenue, Days, Daily Velocity

## Key Features
1. ✅ **No API calls** - Everything from database
2. ✅ **Real-time data** - Refresh button fetches latest
3. ✅ **Cost calculations** - Uses `standard_cost` from `product_skus` table
4. ✅ **Expandable cards** - Click chevron to see SKU-level details
5. ✅ **Mobile optimized** - Responsive grid layout
6. ✅ **Debug-friendly** - All stats visible at a glance

## Database Tables Used
- `amazon_inventory_snapshots` - Amazon FBA inventory
- `warehouse_wip_units` - CATV warehouse data
- `product_skus` - SKU standard costs
- `amazon_financial_line_items` - Sales transactions

## Navigation
**Business → Business Analysis → Sales Velocity**

## Next Steps
1. Implement EMG warehouse data fetch
2. Add filters (date range, SKU search)
3. Add export functionality
4. Add charts/visualizations
5. Add stockout risk indicators

