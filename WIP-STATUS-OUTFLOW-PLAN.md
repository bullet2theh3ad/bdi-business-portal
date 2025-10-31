# 🔄 WIP Status & Outflow Implementation Plan

## 📊 Data Analysis Summary

**Total Units**: 13,038

### WIP Status Distribution
- **RECEIVED**: 7,670 units (58.8%) - Intake performed, serial number entered
- **PASSED**: 2,632 units (20.2%) - Triaged as good, next: Kitting
- **SHIPPED**: 1,281 units (9.8%) - Units out of facility
- **RTS-NEW**: 801 units (6.1%) - Unopened, resealed in gaylord
- **FAILED**: 426 units (3.3%) - Failed triage, next: repair/recycle
- **RTS-KITTED**: 215 units (1.6%) - Recovered, accessories added, sealed
- **MISSING**: 13 units (0.1%) - Box returned but device missing

### Outflow Distribution
- **No Outflow/In WIP**: 11,840 units (90.8%)
- **EMG**: 512 units (3.9%)
- **ISSOY**: 396 units (3.0%)
- **SVT**: 290 units (2.2%)

### New Excel Columns
1. **WIP Status** (Column 15) - Processing status identifier
2. **Outflow** (Column 16) - Destination identifier for shipped units

### Removed Columns
- EMG Ship Date
- EMG Invoice Date
- (2 other EMG-related columns)

---

## 🎯 Feature 1: WIP Status Page

### Visual Concept
Left-to-right flow visualization showing the journey of units through processing stages.

### Proposed Flow Stages (Left → Right)
```
RECEIVED → PASSED → [FAILED] → RTS-NEW → RTS-KITTED → SHIPPED
                     ↓
                  RECYCLED
                     ↓
                  MISSING
```

### UI Design Ideas

#### Option A: Sankey Diagram (Flow Chart)
- Visual flow showing quantities moving between stages
- Thickness of arrows represents volume
- Interactive: click on flow to see details
- Best for understanding transitions

#### Option B: Horizontal Process Bar
- Similar to Sales Velocity bubble chart
- Each status gets a column with count
- Color-coded by status health:
  - 🟢 Green: RECEIVED, PASSED, RTS-NEW, RTS-KITTED, SHIPPED
  - 🟡 Yellow: FAILED
  - 🔴 Red: MISSING
  - ⚫ Gray: RECYCLED
- Bubbles sized by quantity

#### Option C: Kanban Board Style
- Cards for each status
- Show count and percentage
- Drill-down to see units in each status
- Can drag/drop if we add status update feature later

### Filters
1. **By SKU/Model Number** - Dropdown with all models
2. **By Source** - Filter by Amazon, CATV, RMA, etc.
3. **By Date Range** - Received date, Invoice date
4. **By ISO Week** - Filter by week received

### Data Tables
- **Summary Table**: Count and % for each status
- **Detailed Units Table**: 
  - Serial Number
  - Model
  - Source
  - WIP Status
  - Received Date
  - Days in Current Status
  - Export to CSV

### Metrics Cards
- **Total WIP Units**: Current count
- **Average Days in WIP**: Time from RECEIVED to SHIPPED
- **Throughput**: Units moved to SHIPPED this week
- **Stuck Units**: Units in same status >30 days

---

## 📤 Feature 2: Outflow Shipped Page

### Visual Concept
Track where shipped units are going - warehouse/customer destinations.

### UI Design Ideas

#### Main Chart Options

**Option A: Pie/Donut Chart**
- Show percentage breakdown by destination
- Click to drill down
- Good for proportion visualization

**Option B: Bar Chart (Horizontal)**
- Sorted by volume (highest to lowest)
- Easy to compare quantities
- Can show multiple metrics (units, value if available)

**Option C: Timeline Chart**
- Show outflow over time by destination
- Stacked area or grouped bars
- Best for trend analysis

### Grouping Logic
Based on current data:
- **EMG** (512 units)
- **ISSOY** (396 units)
- **SVT** (290 units)
- **Other/Unknown** (if new destinations appear)

### Filters
1. **By Destination** - Checkboxes for EMG, ISSOY, SVT, etc.
2. **By Date Range** - Shipped date range
3. **By SKU/Model** - Filter by model number
4. **By Source** - Original intake source

### Data Table
- **Destination** | **Units** | **Models** | **Date Range** | **% of Total**
- Sortable columns
- Click to see detail breakdown
- Export to CSV

### Summary Cards
- **Total Shipped Units**: All-time
- **This Week Shipped**: Current week
- **Top Destination**: Highest volume
- **Active Destinations**: Count of unique outflows

---

## 🛠️ Implementation Steps

### Step 1: Database Updates ✅ (To Do)
1. Add `wip_status` column to `warehouse_wip_units` table
2. Add `outflow` column to `warehouse_wip_units` table
3. Create indexes for performance

### Step 2: Parser Updates ✅ (To Do)
1. Update `wip-excel-parser.ts` to parse new columns
2. Remove EMG column parsing
3. Add validation for WIP Status enum
4. Handle Outflow as optional string

### Step 3: API Updates ✅ (To Do)
1. Update import API to handle new columns
2. Create new endpoints:
   - `GET /api/warehouse/wip/status` - Status flow data
   - `GET /api/warehouse/wip/outflow` - Outflow analytics

### Step 4: UI Components ✅ (To Do)
1. Create `WIPStatusPage` component
2. Create `OutflowShippedPage` component
3. Add menu items to sidebar

### Step 5: Visualization Libraries
Already have:
- ✅ Recharts (for charts)
- ✅ Lucide icons

May need:
- D3.js for Sankey (if we go that route)

---

## 🎨 Recommended Approach

### For WIP Status Page
**Recommendation**: Start with **Option B - Horizontal Process Bar** (like Sales Velocity)
- Familiar UI pattern for users
- Easy to implement with existing Recharts
- Can enhance to Sankey later if needed

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  WIP Status Flow                                    [Export] │
├─────────────────────────────────────────────────────────────┤
│  Filters: [SKU] [Source] [Date Range] [Clear]              │
├─────────────────────────────────────────────────────────────┤
│  Summary Cards:                                              │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                       │
│  │ WIP  │ │ Avg  │ │This │ │Stuck │                       │
│  │7,670 │ │15d   │ │Week │ │  42  │                       │
│  └──────┘ └──────┘ └──────┘ └──────┘                       │
├─────────────────────────────────────────────────────────────┤
│  Process Flow:                                              │
│                                                             │
│  RECEIVED    PASSED     FAILED    RTS-NEW  RTS-KITTED SHIPPED│
│  ─────●──────────●────────●────────●────────●─────────●───  │
│   7670        2632      426       801      215       1281   │
│  (58.8%)     (20.2%)   (3.3%)   (6.1%)   (1.6%)    (9.8%)  │
│                                                             │
│  [Bubble visualization with sizes proportional to count]    │
├─────────────────────────────────────────────────────────────┤
│  Detailed Units Table:                                      │
│  Serial | Model | Source | Status | Days | Date | Actions  │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
```

### For Outflow Page
**Recommendation**: **Horizontal Bar Chart + Trend Line**
- Clear comparison of destinations
- Timeline shows trends
- Simple and effective

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  Outflow Shipped                                    [Export] │
├─────────────────────────────────────────────────────────────┤
│  Filters: [Destination] [Date Range] [SKU] [Clear]         │
├─────────────────────────────────────────────────────────────┤
│  Summary Cards:                                              │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                       │
│  │Total │ │This  │ │ Top  │ │Active│                       │
│  │1,198 │ │Week  │ │ EMG  │ │  3   │                       │
│  └──────┘ └──────┘ └──────┘ └──────┘                       │
├─────────────────────────────────────────────────────────────┤
│  Destination Breakdown:                                     │
│                                                             │
│  EMG    ████████████████████ 512 (42.7%)                   │
│  ISSOY  ███████████████ 396 (33.1%)                        │
│  SVT    ████████████ 290 (24.2%)                           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Weekly Trend:                                              │
│  [Line/Area chart showing shipments over time by destination]│
├─────────────────────────────────────────────────────────────┤
│  Shipment Details Table:                                    │
│  Destination | Units | Models | Date Range | %             │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 📍 Menu Structure Update

Current:
```
Admin > WIP Dashboard
       > WIP Flow
       > RMA
```

Proposed:
```
Admin > WIP Dashboard
       > WIP Flow
       > WIP Status        ⭐ NEW
       > Outflow Shipped   ⭐ NEW  
       > RMA
```

**Icons**:
- WIP Status: `TrendingRight` or `GitBranch` (flow concept)
- Outflow Shipped: `Package` or `Truck` (shipping concept)

---

## 🚦 Next Steps - Your Approval

Before I start coding, please confirm:

1. ✅ **WIP Status Page Design**: Do you like Option B (Horizontal Process Bar)?
2. ✅ **Outflow Page Design**: Horizontal Bar Chart + Trend?
3. ✅ **Menu Names**: "WIP Status" and "Outflow Shipped" OK?
4. ✅ **Flow Order**: Does the left-to-right progression make sense?
5. ✅ **Any other metrics** you want to see?

Once you give the green light, I'll proceed step-by-step:
1. Update database schema
2. Update parser for new columns
3. Create WIP Status page
4. Create Outflow page
5. Test with your Excel file

Let me know your thoughts! 🚀

