# BDI Cash Forecast Excel Redesign Plan

## Executive Summary

**Current Issues:**
- Hardcoded dates require creating a new file every week
- Labor Spend lacks professional categorization (just "Sales and Marketing", "Contract", "Staff")
- No clear operational vs. G&A vs. R&D breakdown
- Weekly Spend is messy and hard to maintain
- No dynamic rolling 13-week window with current week highlighted

**Goal:** Single dynamic file that updates automatically with proper professional accounting categories

---

## 📊 Current File Structure Analysis

### Main Tabs:
1. **CURRENT WEEK CASHFLOW FORECAST** - Main summary view (currently weeks 1-12+ hardcoded)
2. **Weekly Spend** - Rollup tab feeding the main forecast
3. **CURRENT FORECAST START DATE** - Contains start date: 2025-11-10

### Detail Tabs Feeding Weekly Spend:
- **Labor Spend** ⚠️ NEEDS MAJOR WORK
- **Cash Receipts** (AR)
- **NRE Inventory** (Product development)
- **SC Cost File** (OpEx categories)
- **Susan PGL** (AP Aging)

### Supporting/Archive Tabs:
- LAST WEEK CASHFLOW FORECAST
- CASHFLOW VARIANCE ANALYSIS
- Various vendor-specific tabs (MTN Payment Schedule, PO 3 Shipment, etc.)

---

## 🚨 Critical Problems Identified

### 1. **Labor Spend Tab - GARBAGE**

**Current State:**
```
Row 9:  K8 | Sales and Marketing (Dariush) | Contract | Labor | [amounts...]
Row 10: K9 | Bonus |  | Labor
Row 11: K10 | Controller/Carolyn | Contract | Labor | $10,000
Row 12: K11 | Sales | Contract | Labor
Row 13: K12 | MD Garden | Contract | Labor | $3,000
Row 14: K14 | Customer Care | Contract | Labor | $20,000
Row 15: K17 | CTO & VP Product Mgt, Amy, Sim | Other | Labor | $20,000
Row 16: K18 | Staff | Payroll | Labor | $46,679.46
```

**Problems:**
- ❌ Names in categories ("Dariush", "Carolyn", "Amy")
- ❌ Vague labels ("Sales and Marketing", "Staff", "Other")
- ❌ No department structure
- ❌ No pay frequency tracking (biweekly vs monthly)
- ❌ No employee vs contractor distinction
- ❌ Mixing roles with names
- ❌ No clear Operations vs G&A vs R&D vs Marketing split

---

## ✅ PROPOSED LABOR SPEND RESTRUCTURE

### New Column Structure:

| ID | Employee/Role | Employment Type | Department | Category | Pay Frequency | Bi-Weekly Rate | Monthly Rate | Weekly Amount | Notes |
|----|---------------|-----------------|------------|----------|---------------|----------------|--------------|---------------|-------|
| L001 | Sales Director | Contract | Sales | G&A - Sales | Monthly | - | $9,533 | $2,200 | Dariush |
| L002 | Controller | Contract | Finance | G&A - Finance | Monthly | - | $10,000 | $2,308 | Carolyn |
| L003 | Garden/Facility Mgr | Contract | Operations | Operations - Facility | Bi-Weekly | $1,500 | - | $1,500 | MD Garden |
| L004 | Customer Support | Contract | Support | Operations - Support | Monthly | - | $20,000 | $4,615 | |
| L005 | CTO/VP Product | FTE | Engineering | R&D - Product | Bi-Weekly | $10,000 | - | $10,000 | Amy |
| L006 | Engineering Team | Payroll | Engineering | R&D - Engineering | Bi-Weekly | $23,340 | - | $23,340 | 5 engineers |
| L007 | Operations Team | Payroll | Operations | Operations - Ops | Bi-Weekly | $15,000 | - | $15,000 | 3 staff |
| L008 | Marketing Manager | Contract | Marketing | Marketing - Ops | Monthly | - | $8,000 | $1,846 | |

### New Categories (GAAP-Aligned):

#### **Operations**
- Operations - Support (Customer Care)
- Operations - Facility (Rent, utilities, garden)
- Operations - Warehouse (Fulfillment, shipping)
- Operations - Quality (QA, testing)

#### **G&A (General & Administrative)**
- G&A - Executive (CEO, COO)
- G&A - Finance (Controller, accounting)
- G&A - Sales (Sales team, commissions)
- G&A - HR/Admin (HR, admin staff)

#### **R&D (Research & Development / NRE)**
- R&D - Engineering (Firmware, hardware, software)
- R&D - Product (Product management, design)
- R&D - Testing (Lab, certification)

#### **Marketing**
- Marketing - Ops (Marketing manager, coordinators)
- Marketing - Digital (Paid ads, SEO, content)
- Marketing - Creative (Design, video, creative)

### Pay Frequency Auto-Calculation:
- **Bi-Weekly**: Amount / 2 per week (52 pay periods/year = 26 pays)
- **Monthly**: Amount * 12 / 52 per week
- **Contract**: As invoiced
- **Hourly**: Hours * Rate per week

---

## 📅 DYNAMIC DATE STRUCTURE

### Current Problem:
```
Row 3: Monday of week | 2025-11-10 | 2025-11-17 | 2025-11-24 | ...
```
**Hardcoded dates** - requires manual update every week!

### Proposed Solution:

**CURRENT FORECAST START DATE Sheet:**
```
Cell B4: Forecast Start Date
Cell C4: =TODAY() - MOD(TODAY()-2, 7)  [Auto-calculates this Monday]
Cell C5: Instructions: "This auto-updates to current Monday"
```

**CURRENT WEEK CASHFLOW FORECAST:**
```
Row 1: Week # | -13 | -12 | -11 | ... | -2 | -1 | 0 | 1 | 2 | ... | 11 | 12 | 13
Row 2: Week Label | (13 wks ago) | ... | (CURRENT WEEK) | ... | (13 wks ahead)
Row 3: Monday Date | ='CURRENT FORECAST START DATE'!$C$4 + (Column# - Current_Col) * 7
```

**Conditional Formatting:**
- Highlight Column where Week # = 0 (current week) in **BOLD GREEN**
- Past weeks (negative) in **LIGHT GRAY**
- Future weeks (positive) in **WHITE**

**Benefits:**
- ✅ File updates automatically every Monday
- ✅ Always see 13 weeks back + 13 weeks forward
- ✅ Current week always highlighted
- ✅ No need to create new file each week
- ✅ Historical data retained and scrolls left as time progresses

---

## 💰 WEEKLY SPEND TAB IMPROVEMENTS

### Current Issues:
- Messy structure with no clear headers
- Hard to understand what feeds what
- No subtotals by category
- No variance tracking

### Proposed Structure:

**Columns:**
| Source Tab | ID | Vendor/Payee | Type | Category | Sub-Category | Week 1 | Week 2 | ... | Notes |

**Add Summary Rows:**
```
LABOR COSTS:
  Operations                     $XX,XXX
  G&A                           $XX,XXX
  R&D                           $XX,XXX
  Marketing                      $X,XXX
  ─────────────────────────────
  TOTAL LABOR                   $XX,XXX

OPERATING EXPENSES:
  Rent & Facilities              $X,XXX
  IT & Software                  $X,XXX
  Insurance                      $X,XXX
  Professional Services          $X,XXX
  ─────────────────────────────
  TOTAL OPEX                    $XX,XXX

INVENTORY/COGS:
  Finished Goods Purchases      $XXX,XXX
  Components                     $XX,XXX
  Shipping/Freight               $X,XXX
  ─────────────────────────────
  TOTAL INVENTORY              $XXX,XXX

CAPITAL EXPENDITURES:
  Equipment                      $X,XXX
  Software Licenses              $XXX
  ─────────────────────────────
  TOTAL CAPEX                   $X,XXX

═══════════════════════════════
TOTAL CASH OUT                 $XXX,XXX
```

---

## 🎯 CURRENT WEEK CASHFLOW FORECAST - Enhanced

### Add These Rows:

**Cash Position Tracking:**
```
Row X: Beginning Cash Balance     $XXX,XXX  (from last week ending)
Row Y: Total Cash In              $XX,XXX
Row Z: Total Cash Out            ($XXX,XXX)
      ─────────────────────────
Row Z+1: Net Cash Flow            $XX,XXX
Row Z+2: Ending Cash Balance      $XXX,XXX
Row Z+3: Cash Runway (weeks)      XX weeks  [Formula: Cash / Avg Weekly Burn]
```

**Variance Analysis Section:**
```
Row Z+5: VARIANCE vs LAST WEEK FORECAST
Row Z+6: Forecasted (Last Week)    $XXX,XXX
Row Z+7: Actual                    $XXX,XXX
Row Z+8: Variance                   $X,XXX  (color-coded: green if positive, red if negative)
Row Z+9: Variance %                 +5.2%
```

**Key Metrics:**
```
Row Z+11: Weekly Burn Rate         $XX,XXX  (avg over 4 weeks)
Row Z+12: Cash Runway              XX weeks
Row Z+13: Break-even Week          Week XX  (when cash flow turns positive)
```

---

## 📝 OTHER EXPENSE DETAIL TABS NEEDED

### 1. **Marketing Spend** (New Tab)
```
Channel          | Campaign      | Vendor  | Type        | Week 1 | Week 2 | ...
Amazon Ads       | Q15 Launch    | Amazon  | Digital Ads | $2,500 | $2,500 |
Google Ads       | Brand Search  | Google  | Digital Ads | $1,000 | $1,000 |
SEO Services     | Content       | Agency  | SEO         | $3,000 | -      |
Creative/Design  | Product Photos| Upwork  | Creative    | $500   | -      |
```

### 2. **OpEx by Category** (New Tab or expand SC Cost File)
```
Category              | Vendor      | Frequency | Amount  | Week 1 | Week 2 | ...
Rent & Facilities     | Landlord    | Monthly   | $5,000  | $1,154 | $1,154 |
Insurance - General   | Acme Ins    | Monthly   | $2,000  | $462   | $462   |
Insurance - D&O       | Acme Ins    | Annual    | $10,000 | $192   | $192   |
AWS/Cloud Services    | AWS         | Monthly   | $3,000  | $692   | $692   |
Software - Salesforce | Salesforce  | Monthly   | $500    | $115   | $115   |
Software - QuickBooks | Intuit      | Annual    | $1,200  | $23    | $23    |
Legal Fees            | Law Firm    | Variable  | -       | $5,000 | -      |
Accounting Fees       | CPA         | Monthly   | $2,000  | $462   | $462   |
```

### 3. **Inventory/COGS Purchases** (Enhance existing)
Better structure for PO tracking:
```
PO# | Vendor | SKU     | Quantity | Unit Cost | Total    | Ship Date | Payment Date | Week Paid
001 | Askey  | Q20     | 5,000    | $106.09   | $530,470 | 3/31/25   | 4/7/25       | Week 2
002 | T&W    | Cable   | 10,000   | $36.55    | $365,500 | 4/14/25   | 4/21/25      | Week 4
```

### 4. **NRE/R&D Projects** (Enhance existing)
```
Project       | Vendor   | Category      | SOW# | Total  | Paid to Date | Week 1 | Week 2 | ...
Q15 EU Cert   | MTN      | Certification | -    | $71,119| $35,000      | $13,828| -      |
Firmware Dev  | Gryphon  | Engineering   | SOW5 | $250K  | $100,000     | $20,000| $20,000|
App Dev       | Gryphon  | Engineering   | SOW5 | $50K   | $20,000      | $5,000 | $5,000 |
```

---

## 🔄 IMPLEMENTATION PLAN

### Phase 1: Dynamic Date Structure (1 hour)
1. Update "CURRENT FORECAST START DATE" with `=TODAY()` formula
2. Add 13 weeks backward (-13 to -1)
3. Add 13 weeks forward (1 to 13)
4. Add conditional formatting to highlight current week (Week 0)
5. Test by changing date to different weeks

### Phase 2: Labor Spend Redesign (2-3 hours)
1. Create new column structure
2. Categorize each person/role into proper department
3. Add pay frequency column
4. Add formulas to auto-calculate weekly amounts
5. Add subtotals by category (Operations, G&A, R&D, Marketing)
6. Update Weekly Spend to pull from new structure

### Phase 3: Weekly Spend Cleanup (2 hours)
1. Add clear section headers
2. Add subtotals for each major category
3. Ensure formulas link correctly to detail tabs
4. Add data validation for categories
5. Add notes column for explanations

### Phase 4: Enhanced Main Forecast Tab (1 hour)
1. Add cash position tracking rows
2. Add cash runway calculation
3. Add variance section
4. Add conditional formatting for alerts (cash < $50K = red)

### Phase 5: New/Enhanced Detail Tabs (2-3 hours)
1. Create Marketing Spend tab
2. Enhance OpEx categorization
3. Improve Inventory/COGS tracking
4. Clean up NRE/R&D project tracking

---

## 📊 KEY FORMULAS

### Current Week Auto-Detection:
```excel
=TODAY() - MOD(TODAY()-2, 7)
```
This always returns the Monday of the current week.

### Weekly Amount from Bi-Weekly:
```excel
=IF(Pay_Frequency="Bi-Weekly", BiWeekly_Rate/2, 
   IF(Pay_Frequency="Monthly", Monthly_Rate*12/52, 
      Manual_Amount))
```

### Cash Runway:
```excel
=Ending_Cash_Balance / AVERAGE(Last_4_Weeks_Burn_Rate)
```

### Variance %:
```excel
=(Actual - Forecasted) / Forecasted
```

---

## 🎯 SUCCESS METRICS

After redesign, you should be able to:
1. ✅ Open the same file every Monday without creating a new version
2. ✅ Instantly see current week highlighted
3. ✅ See 13 weeks of history and 13 weeks of forecast
4. ✅ Understand labor costs by department (Ops vs G&A vs R&D vs Marketing)
5. ✅ Calculate cash runway at a glance
6. ✅ Track variance between forecast and actual
7. ✅ Present to CFO/Board without embarrassment
8. ✅ Onboard a new bookkeeper in < 1 hour

---

## 💡 PROFESSIONAL ACCOUNTING STANDARDS

### Labor Categories (aligned with GAAP):
- **Cost of Goods Sold (COGS)**: Direct labor for production (e.g., warehouse staff)
- **Research & Development (R&D)**: Engineers, product managers, testing
- **Sales & Marketing (S&M)**: Sales team, marketing staff, ads
- **General & Administrative (G&A)**: Executive, finance, HR, legal, rent

### Why This Matters:
- Enables proper P&L reporting
- Allows comparison to industry benchmarks
- Required for investor/board reporting
- Facilitates budgeting and variance analysis
- Makes audits smoother

---

## 🚀 NEXT STEPS

1. **Review this plan** - discuss any questions
2. **Prioritize phases** - which to tackle first?
3. **Gather missing data** - e.g., pay frequencies, department assignments
4. **Create backup** - save current file as "BDI Cash Forecast - ARCHIVE 2025-11-10.xlsx"
5. **Implement Phase 1** - dynamic dates (quick win)
6. **Implement Phase 2** - Labor Spend (biggest cleanup)
7. **Test & validate** - ensure formulas work correctly
8. **Train team** - ensure bookkeeper understands new structure

---

## Questions to Discuss:

1. **Labor categorization** - Do you agree with proposed categories? Any missing roles?
2. **Pay frequency** - Do we have accurate data for each person's pay schedule?
3. **OpEx categories** - What other recurring expenses am I missing?
4. **Marketing spend** - Is this tracked anywhere currently?
5. **Timeline** - When do you need this completed?
6. **Ownership** - Who will maintain this file going forward?


