# SKU Financial Scenario - Excel Structure Update

## ✅ **COMPLETED (Solution A)**

### **1. Removed Duplicate Sections**
- ✅ Removed old duplicate form sections (lines 1242-1581)
- ✅ Cleaned up corrupted HTML structure
- ✅ File now has clean, non-duplicated sections

### **2. Updated Data Structure**
The `SKUWorksheetData` interface now includes:

#### **Top Section:**
- `asp` - Average Selling Price
- `fbaFeePercent` / `fbaFeeAmount` - FBA Fee (8% default)
- `amazonReferralFeePercent` / `amazonReferralFeeAmount` - Amazon Referral Fee (8% default)
- `acosPercent` / `acosAmount` - Advertising Cost of Sale (8% default)

#### **Less Frontend Section:**
- `motorolaRoyaltiesPercent` / `motorolaRoyaltiesAmount` - Motorola Royalties (5% of Net Sales)
- `rtvFreightAssumptions` - RTV Freight ($0.80 default)
- `rtvRepairCosts` - RTV Repair Costs ($2.93 default)
- `doaCredits` - DOA Credits
- `invoiceFactoringNet` - Invoice Factoring (Net)
- `salesCommissionsPercent` / `salesCommissionsAmount` - Sales Commissions
- `totalBackendCosts` - Total Backend Costs
- `otherFrontendCosts` - Dynamic array of other frontend costs

#### **Landed DDP Calculations Section:**
- `importDutiesPercent` / `importDutiesAmount` - Import Duties (% of ExWorks)
- `exWorksStandard` - ExWorks Standard
- `importShippingSea` - Import Shipping - Sea
- `gryphonSoftware` - Gryphon Software ($2.50 default)
- `otherLandedCosts` - Dynamic array of other landed costs

### **3. Added Sync Functions**
Percentage ↔ Dollar auto-calculation for:
- `syncFbaFee(percent?, amount?)` - Syncs FBA Fee
- `syncAmazonReferralFee(percent?, amount?)` - Syncs Amazon Referral Fee
- `syncAcos(percent?, amount?)` - Syncs ACOS
- `syncMotorolaRoyalties(percent?, amount?)` - Syncs Motorola Royalties (% of Net Sales)
- `syncSalesCommissions(percent?, amount?)` - Syncs Sales Commissions
- `syncImportDuties(percent?, amount?)` - Syncs Import Duties (% of ExWorks)

### **4. Updated Calculations**
```typescript
// Net Sales = ASP - FBA Fee - Amazon Referral Fee - ACOS
calculateNetSales()

// Total Frontend Costs = Sum of all frontend costs
calculateTotalFrontendCosts()

// Landed DDP = ExWorks + Import Duties + Import Shipping + Gryphon + Other
calculateLandedDDP()

// Gross Profit = Net Sales - Total Frontend Costs - Landed DDP
calculateGrossProfit()

// Gross Margin % = (Gross Profit / ASP) * 100
calculateGrossMargin()
```

### **5. Updated Save Function**
The `handleSaveConfirm` function now saves all new fields to the database via the API.

### **6. New Form Sections**
- **Section 1:** SKU Selection & Pricing (SKU, Channel, Country, ASP)
- **Section 2:** Amazon Fees & Advertising (FBA Fee, Referral Fee, ACOS with % and $ inputs)
- **Section 3:** Net Sales (Calculated - green card)
- **Section 4:** Less Frontend Costs (Motorola Royalties, RTV, DOA, Factoring, Commissions, Backend, Other)
- **Section 5:** Landed DDP Calculations (Import Duties, ExWorks, Shipping, Gryphon, Other)
- **Section 6:** Gross Profit & Margin (Calculated - green cards with breakdown)

---

## 📋 **NEXT STEPS (Solution B - Database)**

### **SQL Script Created: `update-sku-financial-scenarios-schema.sql`**

This script:
1. **Drops the old table** (⚠️ WARNING: Deletes all existing scenarios!)
2. **Creates new table** with updated schema matching the Excel structure
3. **Adds indexes** for performance
4. **Sets up RLS policies** for security
5. **Creates a view** with calculated fields for reporting
6. **Includes documentation** and comments

### **How to Run:**

#### **Option 1: Fresh Start (Recommended for Development)**
```sql
-- Run the entire script in Supabase SQL Editor
-- This will drop the old table and create the new one
```

#### **Option 2: Preserve Old Data (Production)**
```sql
-- 1. Backup existing data first
CREATE TABLE sku_financial_scenarios_backup AS 
SELECT * FROM sku_financial_scenarios;

-- 2. Then run the update script

-- 3. Write custom migration to map old → new fields (manual)
```

### **Database Changes Summary:**

#### **New Columns Added:**
- `fba_fee_percent`, `fba_fee_amount`
- `amazon_referral_fee_percent`, `amazon_referral_fee_amount`
- `acos_percent`, `acos_amount`
- `motorola_royalties_percent`, `motorola_royalties_amount`
- `rtv_freight_assumptions`, `rtv_repair_costs`
- `doa_credits`, `invoice_factoring_net`
- `sales_commissions_percent`, `sales_commissions_amount`
- `total_backend_costs`
- `other_frontend_costs` (JSONB)
- `import_duties_percent`, `import_duties_amount`
- `ex_works_standard`, `import_shipping_sea`
- `gryphon_software`
- `other_landed_costs` (JSONB)

#### **Columns Removed:**
- `reseller_margin_percent`
- `marketing_reserve_percent`
- `fulfillment_costs`
- `product_cost_fob`
- `sw_license_fee`
- `other_product_costs`
- `returns_freight`, `returns_handling`
- `doa_channel_credit` (renamed to `doa_credits`)
- `financing_cost`
- `pps_handling_fee`
- `inbound_shipping_cost`, `outbound_shipping_cost`
- `greenfile_marketing` (removed - not in Excel)
- `other_cogs`

---

## 🧪 **Testing Checklist**

### **Frontend Testing:**
- [ ] SKU dropdown loads correctly
- [ ] Channel and Country dropdowns work
- [ ] ASP input updates all percentage-based amounts
- [ ] FBA Fee: Entering % calculates $, entering $ calculates %
- [ ] Amazon Referral Fee: Entering % calculates $, entering $ calculates %
- [ ] ACOS: Entering % calculates $, entering $ calculates %
- [ ] Net Sales calculation is correct
- [ ] Motorola Royalties: % of Net Sales calculates correctly
- [ ] Sales Commissions: % of ASP calculates correctly
- [ ] Import Duties: % of ExWorks calculates correctly
- [ ] "Add Line" buttons work for Other Frontend Costs
- [ ] "Add Line" buttons work for Other Landed Costs
- [ ] Delete line item buttons work
- [ ] Gross Profit calculation is correct
- [ ] Gross Margin % calculation is correct
- [ ] Save Scenario button works
- [ ] Mobile layout is responsive

### **Backend Testing:**
- [ ] Run SQL script in Supabase
- [ ] Verify table structure with verification queries
- [ ] Test creating a new scenario
- [ ] Test updating an existing scenario
- [ ] Test loading a saved scenario
- [ ] Verify RLS policies work (users can only see their own scenarios)
- [ ] Test the calculated view (`sku_financial_scenarios_with_calculations`)

---

## 📊 **Example Data (from Excel)**

```
SKU: MG8702
ASP: $277.00

FBA Fee: 8% = $22.16
Amazon Referral Fee: 8% = $22.16
ACOS: 8% = $22.16
Net Sales: $225.52

Motorola Royalties: 5% (of Net Sales) = $11.28
RTV Freight: $0.80
RTV Repair: $2.93
DOA Credits: $4.51
Invoice Factoring: $0 (Net)
Sales Commissions: 0%
Total Backend Costs: $19.52

ExWorks Standard: $136.50
Import Duties: 0%
Import Shipping - Sea: $2.30
Gryphon Software: $2.50
Landed DDP: $141.30

Gross Profit: $64.70
Gross Margin: 29%
```

---

## 🚀 **Deployment Steps**

1. **Commit Frontend Changes:**
   ```bash
   git add app/(dashboard)/admin/business-analysis/sku-financial-entry/worksheet/page.tsx
   git commit -m "Update SKU Scenario worksheet to match Excel structure"
   ```

2. **Run Database Migration:**
   - Open Supabase SQL Editor
   - Copy contents of `update-sku-financial-scenarios-schema.sql`
   - Run the script
   - Verify with verification queries at the bottom

3. **Update API Routes:**
   - The API routes should automatically handle the new fields
   - Test POST `/api/business-analysis/sku-scenarios`
   - Test PUT `/api/business-analysis/sku-scenarios/[id]`
   - Test GET `/api/business-analysis/sku-scenarios/[id]`

4. **Test End-to-End:**
   - Create a new scenario
   - Enter data matching the Excel example
   - Save the scenario
   - Reload the page
   - Verify all calculations are correct

5. **Build and Deploy:**
   ```bash
   pnpm build
   git push
   ```

---

## 📝 **Notes**

- **Channel & Country:** Kept unchanged - still important for context
- **Percentage/Dollar Sync:** User can enter either, the other auto-calculates
- **Dynamic Line Items:** "Other Frontend Costs" and "Other Landed Costs" allow unlimited custom entries
- **Mobile Optimized:** All inputs and layouts are responsive
- **Auto-select on Focus:** All number inputs auto-select for easy editing
- **Calculation Order:**
  1. ASP → FBA Fee, Referral Fee, ACOS (% of ASP)
  2. Net Sales = ASP - Fees
  3. Motorola Royalties (% of Net Sales)
  4. Total Frontend Costs
  5. Import Duties (% of ExWorks)
  6. Landed DDP
  7. Gross Profit & Margin

---

## ⚠️ **Breaking Changes**

This is a **major schema redesign**. The old and new structures are **incompatible**.

**Migration Path:**
- If you have existing scenarios you want to keep, you'll need to write a custom migration script
- The old fields don't map 1:1 to the new fields
- Recommend starting fresh for development/testing
- For production, backup old data first

---

## 🎯 **Key Features**

1. **Flexible Input:** Enter percentage OR dollar amount - the other calculates automatically
2. **Excel Parity:** Structure matches the provided Excel worksheet exactly
3. **Dynamic Costs:** Add unlimited "Other" line items for both Frontend and Landed costs
4. **Real-time Calculations:** All totals update instantly as you type
5. **Mobile Friendly:** Fully responsive design with touch-optimized inputs
6. **Validation:** Required fields marked, auto-select on focus for easy editing
7. **Database View:** Calculated fields available in `sku_financial_scenarios_with_calculations` view

---

**Ready to test! Run the SQL script and try creating a scenario.** 🚀

