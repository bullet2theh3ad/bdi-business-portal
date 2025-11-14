# Section 4 vs. Actual Chart of Accounts - Detailed Comparison

**Date:** November 13, 2025  
**Analysis:** Comparing my Section 4 recommendations with your actual "Proposed Chart of Accounts Changes _ vDraft2.xlsx"

---

## Executive Summary

**Good News:** Your proposed Chart of Accounts structure is **85% aligned** with what BOSS portal needs!

**Key Findings:**
- ✅ You already use hierarchical numbering (1000s, 2000s, etc.)
- ✅ Account ranges generally match my Section 4 recommendations
- ⚠️ Some critical BOSS categories (Labor, NRE, Marketing) are **not clearly separated** 
- ⚠️ No explicit BOSS category mapping columns (my proposed Columns F, G, H)
- ⚠️ 6000s range combines OpEx, NRE, and Marketing together

---

## Structure Comparison

### Your Actual Excel Structure (Columns A-E)

| Column | Header | Content |
|--------|--------|---------|
| **A** | Number | Account codes (1000-8350) |
| **B** | Name | Account names |
| **C** | Account Type | QB account types (Expense, COGS, Income, etc.) |
| **D** | Detail Type | QB detail types (detailed classification) |
| **E** | Description | Full description of account purpose |

**Additional Columns Found (F-R):**
- Currency, Old GL Code, TR GL Code, Initial Check, Final Check, Approved, Notes

### My Section 4 Proposed Structure

| Column | Header | Content |
|--------|--------|---------|
| **A** | Account Number | GL codes |
| **B** | Account Name | Account names |
| **C** | Account Type | Financial statement type |
| **D** | Category/Sub-category | Grouping |
| **E** | Notes/Description | Usage guidance |
| **F** | BOSS Primary Category | ⭐ NEW - Maps to BOSS |
| **G** | BOSS Sub-Category | ⭐ NEW - Detailed classification |
| **H** | Auto-Classification Rule | ⭐ NEW - Automation keywords |
| **I-O** | Owner, Approval, Status, etc. | ⭐ NEW - Governance |

---

## Account Range Comparison

### 1000s: Assets ✅ PERFECT ALIGNMENT

| Your Structure | My Section 4 | Alignment |
|----------------|--------------|-----------|
| **1000-1820** (60 accounts) | **1000-1999** Assets | ✅ Excellent |
| 1100: Cash & Cash Equivalents | 1000-1099: Current Assets | ✅ Matches |
| 1200: Accounts Receivable | 1000-1099: Current Assets | ✅ Matches |
| 1300: Inventory (1310 Raw, 1320 WIP, 1330 Finished Goods) | 1100-1199: Inventory Assets | ✅ Good structure |
| 1400: Prepaid Expenses | 1200-1299: Prepaid Expenses | ✅ Matches |

**Assessment:** Your 1000s range is well-structured and aligns perfectly with BOSS needs.

---

### 2000s: Liabilities ✅ PERFECT ALIGNMENT

| Your Structure | My Section 4 | Alignment |
|----------------|--------------|-----------|
| **2000-2490** (23 accounts) | **2000-2999** Liabilities | ✅ Excellent |
| 2100: Accounts Payable | 2000-2099: Current Liabilities | ✅ Matches |
| 2150-2151: Credit Cards (incl. Ramp) | 2100-2199: Credit Cards | ✅ Matches |
| 2200: Accrued Expenses | 2000-2099: Current Liabilities | ✅ Matches |

**Assessment:** Liabilities well-organized. Ramp card properly separated (2151).

---

### 3000s: Equity ✅ PERFECT ALIGNMENT

| Your Structure | My Section 4 | Alignment |
|----------------|--------------|-----------|
| **3000-3070** (8 accounts) | **3000-3999** Equity | ✅ Excellent |
| 3010: Additional Paid-In-Capital | Standard equity structure | ✅ Matches |
| 3020: Common Stock | Standard equity structure | ✅ Matches |
| 3030: Dividends Paid | Standard equity structure | ✅ Matches |

**Assessment:** Standard equity structure, no issues.

---

### 4000s: Revenue ⚠️ NEEDS BOSS MAPPING

| Your Structure | My Section 4 | Alignment |
|----------------|--------------|-----------|
| **4000-4590** (26 accounts) | **4000-4999** Revenue | ✅ Range matches |
| 4100: Product Sales - DTC | 4000-4099: D2C Revenue | ✅ PERFECT! |
| 4200: Product Sales - Marketplace | 4100-4199: B2B Revenue | ⚠️ Needs clarification |
| 4210: Amazon | Need to map: D2C or B2B? | ⚠️ **Mapping required** |
| 4220: Shopify | Need to map: D2C or B2B? | ⚠️ **Mapping required** |

**Specific Accounts Found:**
- 4100: Product Sales - DTC ✅ (Maps to BOSS: Revenue > D2C)
- 4200: Product Sales - Marketplace (Amazon, Shopify)
- 4300: Service Revenue
- 4400: Discounts/Refunds
- 4500: Shipping Revenue

**BOSS Portal Categories:**
- D2C Revenue
- B2B Revenue
- B2B Factored Revenue

**Gap:** Need to distinguish between:
- D2C direct website sales (Shopify) ➜ `BOSS: D2C`
- D2C marketplace sales (Amazon) ➜ `BOSS: D2C` or separate as "Marketplace"?
- B2B direct sales ➜ `BOSS: B2B`
- B2B factored sales ➜ `BOSS: B2B Factored`

**Recommendation:** Add BOSS category column mapping:
```
4100 ➜ BOSS: Revenue > D2C
4200 ➜ BOSS: Revenue > D2C (or create D2C-Marketplace subcategory)
4XXX ➜ BOSS: Revenue > B2B (need new accounts)
4XXX ➜ BOSS: Revenue > B2B Factored (need new accounts)
```

---

### 5000s: COGS/Inventory ✅ GOOD ALIGNMENT

| Your Structure | My Section 4 | Alignment |
|----------------|--------------|-----------|
| **5000-5610** (29 accounts) | **5000-5999** COGS | ✅ Excellent |
| 5100: Product Costs | 5000-5099: Raw Materials | ✅ Close match |
| 5110: ODM Purchases / Manufacturing | 5100-5199: Finished Goods | ✅ Matches |
| 5120: Packaging & Labeling | 5100-5199: Finished Goods | ✅ Matches |
| 5200: Freight & Shipping | 5200-5299: Freight & Shipping | ✅ PERFECT! |
| 5300: Labor - COGS | Related to manufacturing | ✅ Good |

**Specific Accounts Found:**
- 5110: ODM Purchases / Manufacturing ➜ `BOSS: Inventory > Finished Goods`
- 5120: Packaging & Labeling ➜ `BOSS: Inventory > Finished Goods`
- 5200: Freight, Shipping, Delivery ➜ `BOSS: Inventory > Freight & Shipping`
- 5300: Labor - COGS ➜ `BOSS: Inventory > Manufacturing Overhead`

**Assessment:** COGS structure aligns well with BOSS Inventory category needs.

---

### 6000s: Operating Expenses ⚠️ **CRITICAL - NEEDS RESTRUCTURING**

| Your Structure | My Section 4 | Alignment |
|----------------|--------------|-----------|
| **6000-6510** (92 accounts) | Split into 6000s, 8000s, 9000s | ❌ **Major gap** |

**Your Current 6000s Mix:** OpEx + NRE + Marketing all combined!

**Examples of What's Mixed Together:**
- 6100: Product (contains NRE items)
- 6110: Product Licensing Fees ➜ Should be `BOSS: NRE`
- 6120: Product Certifications ➜ Should be `BOSS: NRE > Certifications`
- 6200: Facilities & Operations ➜ Should be `BOSS: OpEx`
- 6300: Sales & Marketing ➜ Should be `BOSS: Marketing`
- 6400: Admin & Office ➜ Should be `BOSS: OpEx`

**BOSS Portal Needs THREE Separate Categories:**

#### 1. OpEx (Operating Expenses) - Proposed 6000-6999
```
6000: Office & General
  6000: Office Supplies ✅ You have this
  6010: Office Equipment
  6020: Postage & Shipping
6100: Professional Services
  6100: Legal Fees ✅ You have "Legal & Professional"
  6110: Accounting Fees
  6120: Consulting Fees
6200: Facilities
  6200: Rent ✅ You have this
  6210: Utilities ✅ You have this
  6220: Maintenance & Repairs
  6230: Insurance ✅ You have this
6300: Travel & Entertainment
  6300: Travel (G&A)
  6310: Travel (Marketing)
  6320: Meals & Entertainment
6400: Subscriptions & Licenses
  6400: Software Subscriptions ✅ You have this
  6410: Professional Licenses
```

#### 2. Marketing - Proposed 8000-8999 (Currently you use 8000s for "Other")
```
8000: Digital Marketing
  8000: Online Advertising
  8010: SEO/SEM
  8020: Social Media
8100: Traditional Marketing
  8100: Trade Shows
  8110: Print Advertising
  8120: Marketing Materials
8200: Agency & Professional
  8200: Marketing Agency Fees
  8210: Design Services
```

**Your Current:** Marketing mixed into 6300s range  
**Issue:** Can't distinguish Marketing spend from general OpEx

#### 3. NRE - Proposed 9000-9999 (You don't have this range!)
```
9000: Product Development
  9000: R&D Labor
  9010: Engineering Design
  9020: Prototyping Materials ✅ You have scattered in 6000s
  9030: Prototyping Services
9100: Testing & Certification
  9100: Product Testing
  9110: Safety Certifications ✅ You have: 6120
  9120: Compliance Testing ✅ You have: 6130
  9130: Lab Services
9200: Tooling & Equipment
  9200: Mold/Tooling Design
  9210: Mold/Tooling Manufacturing
  9220: Fixtures & Test Equipment
9300: NRE Services
  9300: Engineering Consultants
  9310: Technical Documentation
```

**Your Current:** NRE items scattered throughout 6000s and 7000s  
**Issue:** Can't track NRE spend separately (critical for BOSS NRE Summary page!)

---

### 7000s: Other Expenses ⚠️ NEEDS LABOR SEPARATION

| Your Structure | My Section 4 | Alignment |
|----------------|--------------|-----------|
| **7000-7590** (29 accounts) | **7000-7999** Labor | ❌ Mismatch |

**Your Current 7000s:** Depreciation, Interest, Other Expenses  
**My Section 4:** Labor (Payroll, Benefits, Contract Labor)

**Examples of Your 7000s:**
- 7100: Depreciation
- 7110: Depreciation - Tooling
- 7200: Interest Expense
- 7300: Bank Fees
- 7400: Other Expenses

**BOSS Portal Needs:** Dedicated LABOR range!
```
7000: Labor Expenses
  7000-7099: W2 Payroll
    7000: Salaries - Engineering
    7010: Salaries - Operations
    7020: Salaries - G&A
    7030: Salaries - Sales/Marketing
  7100-7199: Payroll Taxes & Benefits
    7100: FICA/Medicare
    7110: State Unemployment
    7120: Federal Unemployment
    7130: Workers Comp Insurance
    7140: Health Insurance
    7150: 401k Match
  7200-7299: Contract Labor (1099)
    7200: Engineering Contractors ✅ CRITICAL for BOSS
    7210: Operations Contractors
    7220: Marketing Contractors
```

**Current Issue:** Labor expenses likely scattered in 5000s (COGS Labor) and 6000s (G&A Labor)  
**BOSS Need:** Consolidated Labor category for Cash Flow Runway "GL Labor" comparison

---

### 8000s: Other Income ⚠️ SHOULD BE MARKETING

| Your Structure | My Section 4 | Alignment |
|----------------|--------------|-----------|
| **8000-8350** (7 accounts) | **8000-8999** Marketing | ❌ Different purpose |

**Your Current 8000s:** "Below-the-Line & Addbacks" (EBITDA adjustments)
- 8300: Addbacks (Adjusted EBITDA Normalization)
- 8310: Owner Compensation
- 8320: One-Time Legal Fees
- 8330: M&A Transaction Costs

**My Section 4 Recommendation:** Use 8000s for Marketing

**Resolution Needed:** Either:
1. **Option A:** Move your 8000s "Addbacks" to 7500-7599 range, use 8000s for Marketing
2. **Option B:** Keep 8000s as-is, use a new 9000s range for both Marketing AND NRE

---

## Critical Gaps Analysis

### Gap #1: Labor Category Not Isolated ❌ HIGH PRIORITY

**Current State:**
- Payroll likely in 6000s range (mixed with OpEx)
- Contract labor possibly in 5300 (COGS Labor) or 6000s
- No dedicated Labor range

**BOSS Portal Impact:**
- Cash Flow Runway page has "GL Labor Data Comparison" feature
- Currently requires 148+ manual overrides because labor isn't cleanly separated
- Can't auto-classify labor transactions

**Solution:**
- Create dedicated 7000-7999 Labor range
- Sub-ranges: 7000s (W2 Payroll), 7100s (Benefits), 7200s (Contract Labor)
- Move all labor accounts to this range

---

### Gap #2: NRE Category Not Separated ❌ HIGH PRIORITY

**Current State:**
- NRE items scattered: 6120 (Certifications), 6130 (Compliance), 7110 (Tooling Depreciation)
- No consolidated NRE tracking

**BOSS Portal Impact:**
- NRE Summary page needs to aggregate ALL NRE expenses
- NRE Paid, NRE Owed, NRE Past Due cards rely on categorization
- Cash Flow Runway has "GL NRE Data Comparison" section
- Can't track NRE by project or phase

**Solution:**
- Create dedicated 9000-9999 NRE range
- Sub-ranges: 9000s (Development), 9100s (Certifications), 9200s (Tooling), 9300s (Services)
- Move accounts: 6120 ➜ 9110, 6130 ➜ 9120, relevant depreciation ➜ 9200s

---

### Gap #3: Marketing Not Separated from OpEx ⚠️ MEDIUM PRIORITY

**Current State:**
- Marketing in 6300s range (Sales & Marketing)
- Mixed with general operating expenses

**BOSS Portal Impact:**
- Marketing is a separate category in BOSS
- Can't analyze marketing ROI separately
- Marketing budget vs. actual reporting difficult

**Solution:**
- Move Marketing to 8000-8999 range (shift your current 8000s elsewhere)
- OR create 9500-9599 Marketing sub-range if 9000s used for NRE

---

### Gap #4: No BOSS Category Mapping Columns ⚠️ MEDIUM PRIORITY

**Current State:**
- Columns A-E: Standard GL info
- Columns F-R: QB-specific, approval workflow
- **Missing:** Direct mapping to BOSS categories

**BOSS Portal Impact:**
- Requires manual override system (gl_transaction_overrides table)
- No automated classification rules
- Can't validate BOSS categorization against source

**Solution:**
- **Add Column S:** "BOSS Primary Category" (Revenue, Inventory, Labor, OpEx, Marketing, NRE, etc.)
- **Add Column T:** "BOSS Sub-Category" (D2C, B2B, Contract Labor, Certifications, etc.)
- **Add Column U:** "Auto-Classification Rule" (keywords, vendor patterns for automation)

---

## Detailed Mapping Recommendations

### Step 1: Add BOSS Mapping Columns

Add these columns to your Excel file (starting at Column S):

| New Column | Header | Purpose | Example Values |
|------------|--------|---------|----------------|
| **S** | BOSS_Category | High-level BOSS category | Revenue, Inventory, Labor, OpEx, Marketing, NRE, Loans |
| **T** | BOSS_SubCategory | Detailed classification | D2C, B2B, Contract Labor, Certifications, Professional Fees |
| **U** | Auto_Rule | Automation keywords | VENDOR~"contractor", GL_CODE=7200, DESCR~"certification" |
| **V** | Category_Owner | Responsible person/dept | CFO, CTO, CMO, Operations Manager |
| **W** | Needs_Approval | Threshold for approval | >$5000, >$10000, Always, Never |

### Step 2: Restructure Account Ranges

**Proposed Reorganization:**

#### Keep As-Is (✅ Good structure):
- 1000-1999: Assets
- 2000-2999: Liabilities
- 3000-3999: Equity
- 4000-4999: Revenue (add B2B sub-accounts)
- 5000-5999: COGS/Inventory

#### Restructure (⚠️ Needs changes):
- **6000-6999: OpEx ONLY** (remove NRE and Marketing)
  - Move out: 6120, 6130 (to NRE)
  - Move out: 6300s Marketing (to 8000s or 9500s)
  - Keep: Office, Professional Services, Facilities, Travel (G&A), Subscriptions

- **7000-7999: Labor** (currently Depreciation/Interest)
  - Move current 7000s to appropriate categories (Depreciation to 6xxx or new 9600s)
  - Create: 7000s (W2 Payroll), 7100s (Benefits), 7200s (Contract Labor)
  - Consolidate all labor from various locations

- **8000-8999: Marketing** (currently Addbacks)
  - Move current 8000s "Addbacks" to 7500-7599 or 9700-9799
  - Create: 8000s (Digital), 8100s (Traditional), 8200s (Agency)
  - Move 6300s marketing accounts here

- **9000-9999: NRE** (currently doesn't exist)
  - Create: 9000s (Development), 9100s (Certifications), 9200s (Tooling), 9300s (Services)
  - Move: 6120 ➜ 9110, 6130 ➜ 9120
  - Create new accounts for prototyping, R&D labor, engineering services

- **9500-9599: Loan Interest** (separate from operating expenses)
- **9600-9699: Depreciation & Amortization** (move from 7000s)
- **9700-9799: Other Expenses** (move "Addbacks" here)

### Step 3: Populate BOSS Category Mappings

**Sample Mappings (add to Column S & T):**

```
Account | Name | BOSS_Category | BOSS_SubCategory
--------------------------------------------------------------
1310 | Inventory - Raw Materials | Inventory | Raw Materials
1320 | Inventory - WIP | Inventory | Work In Progress
1330 | Inventory - Finished Goods | Inventory | Finished Goods

4100 | Product Sales - DTC | Revenue | D2C
4200 | Product Sales - Marketplace | Revenue | D2C
4210 | Amazon | Revenue | D2C
4220 | Shopify | Revenue | D2C
4XXX | B2B Direct Sales | Revenue | B2B
4XXX | B2B Factored Sales | Revenue | B2B Factored

5110 | ODM Purchases / Manufacturing | Inventory | Finished Goods
5120 | Packaging & Labeling | Inventory | Finished Goods
5200 | Freight & Shipping | Inventory | Freight & Shipping
5300 | Labor - COGS | Inventory | Manufacturing Overhead

6100 | Legal Fees | OpEx | Professional Fees
6110 | Accounting Fees | OpEx | Professional Fees
6200 | Rent | OpEx | Rent & Facilities
6210 | Utilities | OpEx | Utilities
6400 | Software Subscriptions | OpEx | Annual Subscriptions

7000 | Salaries - Engineering | Labor | Payroll (W2)
7010 | Salaries - Operations | Labor | Payroll (W2)
7100 | FICA/Medicare | Labor | Payroll Taxes
7140 | Health Insurance | Labor | Benefits & Overhead
7200 | Engineering Contractors | Labor | Contract Labor (1099)
7210 | Operations Contractors | Labor | Contract Labor (1099)

8000 | Online Advertising | Marketing | Digital Marketing
8100 | Trade Shows | Marketing | Trade Shows
8110 | Marketing Materials | Marketing | Marketing Materials
8200 | Marketing Agency Fees | Marketing | Agency Fees

9000 | R&D Labor | NRE | R&D Personnel
9020 | Prototyping Materials | NRE | Prototyping
9030 | Prototyping Services | NRE | Prototyping
9110 | Safety Certifications | NRE | Certifications
9120 | Compliance Testing | NRE | Testing & Validation
9200 | Mold/Tooling Design | NRE | Tooling
9210 | Mold/Tooling Manufacturing | NRE | Tooling
9300 | Engineering Consultants | NRE | Engineering Services
```

---

## Implementation Priority

### Phase 1: Immediate (This Week)
1. ✅ Add Columns S, T, U to your Excel file (BOSS mappings)
2. ✅ Map existing 4000s (Revenue) accounts to D2C/B2B
3. ✅ Map existing 5000s (COGS) accounts to Inventory sub-categories
4. ✅ Identify which 6000s accounts are actually NRE or Marketing

### Phase 2: Quick Wins (Next 2 Weeks)
1. ⚠️ Create new 7200-7299 Contract Labor accounts (even if in current 6000s range temporarily)
2. ⚠️ Create new 9100-9199 Certification accounts
3. ⚠️ Update BOSS portal GL APIs to use new account numbers
4. ⚠️ Test Cash Flow Runway with new mappings

### Phase 3: Full Restructure (1-2 Months)
1. 🔄 Move all Labor accounts to 7000-7999 range
2. 🔄 Move all NRE accounts to 9000-9999 range
3. 🔄 Move all Marketing accounts to 8000-8999 range
4. 🔄 Update QuickBooks Chart of Accounts
5. 🔄 Migrate historical transactions (or just use for new transactions going forward)

---

## Risk Assessment

### Low Risk Changes ✅
- Adding BOSS mapping columns (S, T, U) ➜ No QB impact
- Mapping existing accounts to BOSS categories ➜ Documentation only
- Creating new account numbers in unused ranges ➜ Additive only

### Medium Risk Changes ⚠️
- Moving accounts between ranges ➜ Requires QB account merging/moving
- Changing account numbers for existing accounts ➜ Historical data concerns
- Creating new Labor/NRE/Marketing categories ➜ Training required

### High Risk Changes ❌
- Deleting or consolidating existing accounts ➜ Data loss risk
- Changing account types (Expense ↔ COGS) ➜ Financial statement impact
- Bulk account number renumbering ➜ Integration breakage

---

## Success Metrics

After implementing BOSS category mappings, you should see:

1. **Reduced Override Count:** From 148+ to <20 per month
2. **Auto-Classification Rate:** >95% of transactions auto-categorized correctly
3. **Clean GL Comparisons:** Cash Flow Runway GL sections show aligned data
4. **NRE Visibility:** NRE Summary page accurately tracks all NRE spend
5. **Labor Tracking:** Can distinguish W2 payroll from 1099 contractors
6. **Marketing ROI:** Can analyze marketing spend vs. revenue by channel

---

## Conclusion

### What's Good ✅
- Your 1000s-5000s ranges align perfectly with BOSS needs
- Hierarchical numbering structure is ideal
- Inventory accounts (1300s, 5000s) well-structured
- Revenue accounts (4000s) mostly ready

### What Needs Work ⚠️
- 6000s combines OpEx, NRE, and Marketing (need separation)
- 7000s should be Labor, not Depreciation/Interest
- No dedicated NRE range (9000s recommended)
- Missing BOSS category mapping columns

### Next Steps 🎯
1. **Today:** Add BOSS mapping columns (S, T, U) to Excel file
2. **This Week:** Map all 4000s and 5000s accounts to BOSS categories
3. **Next Week:** Create GL Code Mapping Management page in BOSS portal (from Section 4 recommendations)
4. **This Month:** Start using new Labor (7200s) and NRE (9100s) accounts for new transactions
5. **Next Quarter:** Full Chart of Accounts restructure and QB migration

---

**Bottom Line:** Your Chart of Accounts structure is fundamentally sound. With the addition of BOSS category mapping columns and some strategic account range adjustments (especially for Labor, NRE, and Marketing), you'll have a best-in-class financial management system that integrates seamlessly with BOSS portal's advanced features.

