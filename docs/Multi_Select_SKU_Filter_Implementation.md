# Multi-Select SKU Filter Implementation

## Overview
Enhanced the Sales Forecast Analysis page to support **multi-select SKU filtering** with checkboxes and "Select All" functionality. Users can now select multiple SKUs simultaneously, and these selections are saved as part of their analysis sessions.

---

## What Changed

### 1. New Component: `MultiSelectDropdown`
**Location:** `/components/MultiSelectDropdown.tsx`

**Features:**
- ✅ Checkbox-based multi-select dropdown
- ✅ "Select All" / "Deselect All" checkbox at the top
- ✅ Built-in search/filter functionality
- ✅ Visual feedback for selected items (checkmarks)
- ✅ Clear All button in footer
- ✅ Selected count display ("X of Y selected")
- ✅ Responsive max-height with scrolling
- ✅ Click-outside-to-close behavior

**Props:**
```typescript
interface MultiSelectDropdownProps {
  options: { value: string; label: string }[];
  selectedValues: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  label?: string;
  maxHeight?: string; // e.g., "max-h-96"
}
```

---

### 2. Updated: Sales Forecast Analysis Page
**Location:** `/app/(dashboard)/admin/business-analysis/sales-forecast-analysis/page.tsx`

#### State Changes
**Before:**
```typescript
const [selectedSKU, setSelectedSKU] = useState<string>('all');
```

**After:**
```typescript
const [selectedSKUs, setSelectedSKUs] = useState<string[]>([]);
```

#### Filtering Logic
**Before:**
```typescript
if (selectedSKU !== 'all' && f.sku?.sku !== selectedSKU) return false;
```

**After:**
```typescript
// Filter by selected SKUs (if any are selected)
if (selectedSKUs.length > 0 && !selectedSKUs.includes(f.sku?.sku || '')) return false;
```

**Logic:**
- If **no SKUs** are selected (`selectedSKUs.length === 0`) → Show **all SKUs**
- If **one or more SKUs** are selected → Show **only those SKUs**

#### Session Saving
**Before:**
```typescript
selectedSku: selectedSKU, // Single SKU
```

**After:**
```typescript
selectedSkus: selectedSKUs, // Array of SKUs
```

#### Session Loading
**Backward Compatible:**
```typescript
// Handle both old format (selectedSku) and new format (selectedSkus)
setSelectedSKUs(
  session.selectedSkus || 
  (session.selectedSku && session.selectedSku !== 'all' ? [session.selectedSku] : [])
);
```

This ensures:
- New sessions save `selectedSkus: string[]`
- Old sessions with `selectedSku: string` still load correctly
- "all" or empty values map to empty array (show all)

#### UI Changes
**Before:**
```tsx
<Select value={selectedSKU} onValueChange={setSelectedSKU}>
  <SelectTrigger>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">All SKUs</SelectItem>
    {skus.map(sku => (
      <SelectItem value={sku.sku}>{sku.sku} - {sku.name}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

**After:**
```tsx
<MultiSelectDropdown
  label="SKU"
  placeholder="All SKUs"
  options={(skus || []).map(sku => ({
    value: sku.sku,
    label: `${sku.sku} - ${sku.name}`
  }))}
  selectedValues={selectedSKUs}
  onChange={setSelectedSKUs}
  maxHeight="max-h-80"
/>
```

---

## User Experience

### How to Use

1. **Select All SKUs (Default)**
   - Leave the SKU dropdown empty
   - Shows "All SKUs" placeholder
   - All forecasts are displayed

2. **Select Multiple SKUs**
   - Click the SKU dropdown
   - Check individual SKUs
   - Or click "Select All" to select all visible SKUs
   - Dropdown shows "3 items selected" (or count)

3. **Search and Select**
   - Type in the search box to filter SKUs
   - Select All will only select filtered/visible SKUs
   - Clear search to see all options again

4. **Clear Selection**
   - Click "Clear All" button in the dropdown footer
   - Or manually uncheck all items
   - Returns to "All SKUs" state

5. **Save Session**
   - Selected SKUs are saved with the session
   - Load the session later to restore exact SKU selection

---

## Technical Details

### Component Architecture

```
Sales Forecast Analysis Page
├── State: selectedSKUs: string[]
├── UI: MultiSelectDropdown component
│   ├── Search input (filter options)
│   ├── "Select All" checkbox
│   ├── Individual checkboxes for each SKU
│   └── "Clear All" button
├── Filtering: selectedSKUs.length > 0 ? filter : show all
└── Session: Save/load selectedSkus array
```

### Filtering Behavior

| Selected SKUs | Result |
|---------------|--------|
| `[]` (empty) | Show all forecasts |
| `['SKU001']` | Show only SKU001 |
| `['SKU001', 'SKU002']` | Show SKU001 and SKU002 |
| `['SKU001', 'SKU002', 'SKU003']` | Show all three SKUs |

### Session Compatibility

| Old Session Format | New Session Format | Result When Loaded |
|--------------------|-------------------|-------------------|
| `selectedSku: 'all'` | N/A | `selectedSKUs = []` (show all) |
| `selectedSku: 'SKU001'` | N/A | `selectedSKUs = ['SKU001']` |
| N/A | `selectedSkus: []` | `selectedSKUs = []` (show all) |
| N/A | `selectedSkus: ['SKU001', 'SKU002']` | `selectedSKUs = ['SKU001', 'SKU002']` |

---

## Benefits

1. **Better Analysis**
   - Compare specific SKUs side-by-side
   - Focus on product families or categories
   - Remove noise from unrelated products

2. **Saved Workflows**
   - Save commonly-used SKU combinations
   - One-click load of previous analysis
   - Team can share analysis configurations

3. **Improved UX**
   - Visual checkboxes easier than dropdown
   - Search helps find SKUs quickly
   - Selected count provides feedback

4. **Backward Compatible**
   - Old sessions still work
   - Gradual migration to new format
   - No data loss

---

## Example Use Cases

### Use Case 1: Analyze Product Family
**Scenario:** User wants to forecast only Motorola WiFi products

**Steps:**
1. Click SKU dropdown
2. Search "Motorola WiFi"
3. Click "Select All" (selects all filtered results)
4. Save session as "Motorola WiFi Analysis"

**Result:** Only Motorola WiFi SKUs shown in charts and metrics

### Use Case 2: Compare Two SKUs
**Scenario:** User wants to compare two specific products

**Steps:**
1. Click SKU dropdown
2. Check "MNQ1525-M30W-E"
3. Check "MNO1234-M50W-E"
4. Save session as "Q1525 vs O1234 Comparison"

**Result:** Side-by-side analysis of two SKUs

### Use Case 3: Exclude Problem SKU
**Scenario:** User wants to see all SKUs except one discontinued item

**Steps:**
1. Click SKU dropdown
2. Click "Select All"
3. Uncheck the discontinued SKU
4. Save session as "Active SKUs Only"

**Result:** All SKUs displayed except the unchecked one

---

## Future Enhancements (Optional)

1. **SKU Groups**
   - Save named SKU groups (e.g., "High Volume", "New Products")
   - Quick-select from saved groups

2. **SKU Categories**
   - Group by manufacturer (Motorola, Brand X, etc.)
   - Collapsible category sections in dropdown

3. **Bulk Actions**
   - "Select High Volume SKUs" (auto-select based on criteria)
   - "Select Recent SKUs" (added in last 30 days)

4. **Export Selection**
   - Export selected SKU list to CSV
   - Share SKU selection via URL parameter

---

## API Impact

### API Endpoint: `/api/forecast-analysis-sessions`

**Request Body (POST):**
```typescript
{
  sessionName: string;
  description: string;
  startDate: string;
  endDate: string;
  selectedSkus: string[];  // Changed from selectedSku: string
  searchQuery: string;
  filters: {};
  selections: Array<{
    forecastId: string;
    skuScenarioId: string | null;
    manualAsp: number | null;
  }>;
}
```

**Database Schema:**
- No database changes required (JSON field stores array)
- Old sessions: `{ selectedSku: "SKU001" }`
- New sessions: `{ selectedSkus: ["SKU001", "SKU002"] }`

---

## Testing Checklist

- [ ] Multi-select works (can select multiple SKUs)
- [ ] "Select All" selects all visible SKUs
- [ ] Search filters options correctly
- [ ] "Clear All" clears all selections
- [ ] Empty selection shows all forecasts
- [ ] Selected SKUs filter correctly
- [ ] Save session with multiple SKUs
- [ ] Load session restores SKU selection
- [ ] Old sessions (single SKU) load correctly
- [ ] Metrics calculate correctly for selected SKUs
- [ ] Charts display correctly for selected SKUs
- [ ] Export includes only selected SKUs (if applicable)

---

## Support

For questions or issues, contact the development team or refer to:
- Component code: `/components/MultiSelectDropdown.tsx`
- Page code: `/app/(dashboard)/admin/business-analysis/sales-forecast-analysis/page.tsx`
- This documentation: `/docs/Multi_Select_SKU_Filter_Implementation.md`

