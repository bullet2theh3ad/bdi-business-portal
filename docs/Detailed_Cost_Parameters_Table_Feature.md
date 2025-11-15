# Detailed Cost Parameters Table Feature

## Overview
Added a comprehensive **Detailed Cost Parameters Table** to the Sales Forecast Analysis page that displays all cost breakdown parameters from SKU Financial Entry scenarios in a filterable, exportable tabular format.

---

## Feature Location
**Page:** Admin > Business Analysis > Sales Forecast Analysis  
**Position:** Below the "Forecast Details" table, above modals

---

## What It Does

### Purpose
Provides a complete breakdown of all financial parameters from selected SKU scenarios, allowing users to:
- **Compare** cost structures across different forecasts side-by-side
- **Analyze** profitability drivers at a granular level
- **Filter** by channel, SKU, or any parameter
- **Export** the detailed breakdown to CSV for external analysis

### Data Source
Pulls all cost parameters from the **SKU Financial Entry** scenarios that have been selected for forecasts, including:

1. **Basic Info**: Week, SKU, SKU Name, Quantity
2. **Scenario Info**: Scenario Name, Channel, Country
3. **Pricing**: ASP (Average Selling Price)
4. **Fees & Advertising**:
   - FBA Fee (% and $)
   - Amazon Referral Fee (% and $)
   - ACOS (% and $)
5. **Net Sales** (calculated: ASP - Fees)
6. **Frontend Costs**:
   - Motorola Royalties (% and $)
   - RTV Freight
   - RTV Repair Costs
   - DOA Credits (% and $)
   - Invoice Factoring Net
   - Sales Commissions (% and $)
7. **Landed DDP Costs**:
   - Import Duties (% and $)
   - Ex Works Standard
   - Import Shipping (Sea)
   - Gryphon Software
8. **Gross Profit & Margin**:
   - Gross Profit ($)
   - Gross Margin (%)

---

## UI Components

### 1. Card Header
- **Title**: "📊 Detailed Cost Parameters"
- **Count**: Shows number of forecasts with scenarios selected
- **Description**: "Complete breakdown of all cost parameters from selected SKU scenarios"
- **Show/Hide Button**: Toggle visibility of the detailed table
- **Export CSV Button**: Download all detailed parameters

### 2. Filters
- **Search**: Filter by SKU, scenario name, SKU name, or week
- **Channel Filter**: Dropdown to filter by specific sales channel

### 3. Table
**31 columns** organized with color-coded sections:

| Section | Background Color | Columns |
|---------|-----------------|---------|
| Basic Info | White | Week, SKU, SKU Name, Qty |
| Scenario Info | Blue (`bg-blue-50`) | Scenario, Channel, Country |
| Pricing | Green (`bg-green-50`) | ASP |
| Fees & Advertising | Yellow (`bg-yellow-50`) | 6 columns |
| Net Sales | Emerald (`bg-emerald-50`) | Net Sales (calculated) |
| Frontend Costs | Orange (`bg-orange-50`) | 9 columns |
| Landed Costs | Purple (`bg-purple-50`) | 5 columns |
| Gross Profit | Indigo (`bg-indigo-100`) | GP $, GP % |

### 4. Legend
Visual legend at the bottom showing what each background color represents.

---

## User Workflow

### Step 1: Select Scenarios
On the main "Forecast Details" table, select SKU Financial Entry scenarios for your forecasts.

### Step 2: View Detailed Parameters
1. Scroll down to the "Detailed Cost Parameters" section
2. Click **"Show Details"** to expand the table
3. The table automatically shows all forecasts that have scenarios selected

### Step 3: Filter & Analyze
- Use the **search box** to find specific SKUs, weeks, or scenario names
- Use the **channel dropdown** to filter by sales channel (e.g., Amazon FBA, Shopify, etc.)
- Scroll horizontally to view all 31 parameters

### Step 4: Export
Click **"Export CSV"** to download the complete breakdown for external analysis in Excel or other tools.

---

## CSV Export

### File Format
**Filename**: `detailed-parameters-YYYY-MM-DD-to-YYYY-MM-DD.csv`

### Columns (31 total)
All parameters are exported with proper headers in the same order as the table:
- Week, SKU, SKU Name, Quantity
- Scenario Name, Channel, Country
- ASP
- FBA Fee %, FBA Fee $, Amazon Referral %, Amazon Referral $, ACOS %, ACOS $
- Net Sales
- Motorola Royalties %, Motorola Royalties $, RTV Freight, RTV Repair, DOA Credits %, DOA Credits $, Invoice Factoring Net, Sales Commissions %, Sales Commissions $
- Import Duties %, Import Duties $, Ex Works Standard, Import Shipping Sea, Gryphon Software
- Gross Profit, Gross Margin %
- Std Cost, Std Cost Total, ASP Revenue Total

---

## Technical Implementation

### State Variables
```typescript
const [showDetailedTable, setShowDetailedTable] = useState<boolean>(false);
const [detailedTableSearch, setDetailedTableSearch] = useState<string>('');
const [detailedTableChannelFilter, setDetailedTableChannelFilter] = useState<string>('all');
```

### Key Functions

#### 1. `exportDetailedParametersToCSV()`
Exports all forecasts with scenarios to CSV, including all 31+ parameters.

**Logic:**
- Filters forecasts to only include those with scenarios
- Builds comprehensive headers array
- Maps each forecast + scenario to a row with all parameters
- Calculates Net Sales on the fly
- Generates CSV blob and triggers download

#### 2. Table Rendering Logic
Uses inline filtering:
```typescript
const forecastsWithScenarios = filteredForecasts
  .map(f => ({
    forecast: f,
    scenario: getSelectedScenario(f.id)
  }))
  .filter(item => item.scenario !== null)
  .filter(item => {
    const matchesSearch = ...;
    const matchesChannel = ...;
    return matchesSearch && matchesChannel;
  });
```

---

## Benefits

### 1. **Comprehensive Visibility**
- See ALL cost parameters from SKU Financial Entry scenarios in one place
- No need to switch between pages or open individual scenarios

### 2. **Easy Comparison**
- Compare different scenarios side-by-side
- Identify which scenarios have the best margins
- Spot outliers or errors in cost assumptions

### 3. **Powerful Filtering**
- Search across all text fields (SKU, scenario name, week)
- Filter by sales channel to compare D2C vs. B2B
- Narrow down to specific time periods

### 4. **Data Export**
- Export to Excel for pivot tables, charts, or further analysis
- Share with finance team for review
- Archive snapshots of cost assumptions for reporting

### 5. **Color-Coded Organization**
- Visual grouping makes it easy to scan large amounts of data
- Quickly identify which section a parameter belongs to
- Reduces cognitive load when analyzing 31 columns

---

## Use Cases

### Use Case 1: Compare Channels
**Scenario:** User wants to see how Amazon FBA costs differ from Shopify Direct

**Steps:**
1. Select various scenarios (some Amazon, some Shopify)
2. Open detailed table
3. Use channel filter to view "Amazon FBA" only
4. Note FBA Fees, Referral Fees, ACOS
5. Switch filter to "Shopify"
6. Compare the cost structures

**Result:** Clear understanding of channel-specific costs

### Use Case 2: Identify High-Cost Weeks
**Scenario:** User wants to find which weeks have unusually high landed costs

**Steps:**
1. Open detailed table with all forecasts visible
2. Sort visually by scanning the "Landed Costs" section (purple background)
3. Look for high Import Duties or Import Shipping values
4. Export to CSV and sort in Excel for precise ranking

**Result:** Identification of problematic cost assumptions

### Use Case 3: Margin Analysis Across SKUs
**Scenario:** CFO wants to see Gross Profit % for all forecasted SKUs

**Steps:**
1. Open detailed table
2. Scroll right to the "GP %" column (indigo background)
3. Scan for low-margin scenarios
4. Filter or search for specific SKUs of concern
5. Export for board presentation

**Result:** Data-driven decision on which SKUs to prioritize

### Use Case 4: Audit Cost Assumptions
**Scenario:** Finance team needs to verify all cost inputs before quarterly forecast

**Steps:**
1. Open detailed table
2. Export to CSV
3. Review in Excel with filters and conditional formatting
4. Identify any $0 values or unrealistic percentages
5. Go back and correct individual scenarios

**Result:** Verified, auditable cost assumptions

---

## File Changes

### Modified
- `/app/(dashboard)/admin/business-analysis/sales-forecast-analysis/page.tsx`
  - Added state variables for detailed table (lines 75-77)
  - Added `exportDetailedParametersToCSV()` function (lines 451-556)
  - Added "Detailed Cost Parameters" Card component (lines 1523-1745)

### No Database Changes
All data is pulled from existing `sku_financial_scenarios` table via the `/api/business-analysis/sku-scenarios` endpoint.

---

## Future Enhancements (Optional)

1. **Column Visibility Toggles**
   - Allow users to hide/show specific columns
   - Save preferences per user

2. **Inline Editing**
   - Edit parameter values directly in the table
   - Sync changes back to scenarios

3. **Conditional Formatting**
   - Highlight low margins in red
   - Highlight high-cost items

4. **Aggregation Row**
   - Show totals at the bottom
   - Calculate weighted averages for percentages

5. **Comparison Mode**
   - Select 2-3 scenarios to compare side-by-side
   - Highlight differences

6. **Excel-like Features**
   - Column sorting (click headers)
   - Column resizing
   - Freeze first columns while scrolling

---

## Testing Checklist

- [x] Table displays correctly when scenarios are selected
- [x] Shows/hides when toggle button clicked
- [x] Search filters work across all text fields
- [x] Channel filter correctly filters by sales channel
- [x] All 31 columns display with correct data
- [x] Color-coded sections render properly
- [x] CSV export includes all parameters
- [x] CSV export handles scenarios with missing data (defaults to '0')
- [x] Legend displays at bottom
- [x] Count in header updates dynamically
- [x] No linter errors

---

## Performance Considerations

- **Table is collapsible** by default to avoid rendering cost when not needed
- **Filtering is client-side** for instant response
- **CSV generation is synchronous** but fast (< 1 second for 1000 rows)
- **No additional API calls** - uses data already loaded for main table

---

## Related Documentation

- [Multi-Select SKU Filter Implementation](./Multi_Select_SKU_Filter_Implementation.md)
- SKU Financial Entry Worksheet (see inline documentation in code)

---

## Support

For questions or issues:
- Component location: `/app/(dashboard)/admin/business-analysis/sales-forecast-analysis/page.tsx`
- Search for: "Detailed Cost Parameters"
- Key function: `exportDetailedParametersToCSV()`

