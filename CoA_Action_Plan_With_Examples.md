# Chart of Accounts → BOSS Portal Integration - Action Plan

**Practical step-by-step guide with specific examples and Excel formulas**

---

## 📋 Phase 1: Add BOSS Mapping Columns (Do This Today!)

### Step 1.1: Add New Columns to Excel

Open your Excel file and add these columns starting at **Column S**:

| Column | Header | Data Type | Example Value |
|--------|--------|-----------|---------------|
| S | BOSS_Category | Dropdown | Revenue, Inventory, Labor, OpEx, Marketing, NRE, Loans, Other |
| T | BOSS_SubCategory | Text | D2C, B2B, Contract Labor, Certifications, Professional Fees |
| U | Auto_Rule | Text | GL=4100, VENDOR~contractor, DESCR~certification |
| V | Category_Owner | Dropdown | CFO, CTO, CMO, COO, Operations Manager |
| W | Approval_Threshold | Text | >$5000, >$10000, Always, Never |

### Step 1.2: Create Dropdown Lists

**For Column S (BOSS_Category):**
1. Select cells S2:S300
2. Data → Data Validation → List
3. Source: `Revenue,Inventory,Labor,OpEx,Marketing,NRE,Loans,Investments,Other`

**For Column V (Category_Owner):**
1. Select cells V2:V300
2. Data → Data Validation → List
3. Source: `CFO,CTO,CMO,COO,Operations Manager,Finance Team`

---

## 📝 Phase 1.2: Populate Initial Mappings

### Sample Mappings (Copy-Paste Ready)

#### Revenue Accounts (4000s)
```
Number  | Name                          | BOSS_Category | BOSS_SubCategory | Auto_Rule      | Owner | Approval
4000    | Revenue                       | Revenue       | (Parent)         | GL=4000        | CFO   | Never
4100    | Product Sales - DTC           | Revenue       | D2C              | GL=4100        | CFO   | Never
4200    | Product Sales - Marketplace   | Revenue       | D2C              | GL=4200        | CFO   | Never
4210    | Amazon                        | Revenue       | D2C              | GL=4210        | CFO   | Never
4220    | Shopify                       | Revenue       | D2C              | GL=4220        | CFO   | Never
4300    | Service Revenue               | Revenue       | Other            | GL=4300        | CFO   | Never
4400    | Discounts/Refunds             | Revenue       | (Contra)         | GL=4400        | CFO   | Never
4500    | Shipping Revenue              | Revenue       | Other            | GL=4500        | CFO   | Never
```

#### COGS/Inventory Accounts (5000s)
```
Number  | Name                          | BOSS_Category | BOSS_SubCategory      | Auto_Rule      | Owner | Approval
5000    | COGS                          | Inventory     | (Parent)              | GL=5000        | COO   | Never
5100    | Product Costs                 | Inventory     | (Parent)              | GL=5100        | COO   | Never
5110    | ODM Purchases / Manufacturing | Inventory     | Finished Goods        | GL=5110        | COO   | >$10000
5120    | Packaging & Labeling          | Inventory     | Finished Goods        | GL=5120        | COO   | >$5000
5130    | Royalties & Licensing Fees    | Inventory     | Finished Goods        | GL=5130        | CFO   | >$5000
5200    | Freight & Shipping            | Inventory     | Freight & Shipping    | GL=5200        | COO   | Never
5300    | Labor - COGS                  | Inventory     | Manufacturing Labor   | GL=5300        | COO   | Never
```

#### OpEx Accounts (6000s) - Clean OpEx Only
```
Number  | Name                          | BOSS_Category | BOSS_SubCategory      | Auto_Rule      | Owner | Approval
6200    | Rent                          | OpEx          | Rent & Facilities     | GL=6200        | CFO   | Always
6210    | Utilities                     | OpEx          | Utilities             | GL=6210        | CFO   | Never
6220    | Insurance                     | OpEx          | Insurance             | GL=6220        | CFO   | Always
6400    | Software Subscriptions        | OpEx          | Annual Subscriptions  | GL=6400        | CTO   | >$1000
6410    | Office Supplies               | OpEx          | Office Supplies       | GL=6410        | COO   | Never
```

#### NRE Accounts (Currently in 6000s - Mark for Moving)
```
Number  | Name                          | BOSS_Category | BOSS_SubCategory      | Auto_Rule      | Owner | Approval | NOTES
6120    | Product Certifications        | NRE           | Certifications        | GL=6120,FUTURE:9110 | CTO | >$2500 | MOVE TO 9110
6130    | Compliance & Registration     | NRE           | Testing & Validation  | GL=6130,FUTURE:9120 | CTO | >$2500 | MOVE TO 9120
```

#### Marketing Accounts (Currently in 6000s - Mark for Moving)
```
Number  | Name                          | BOSS_Category | BOSS_SubCategory      | Auto_Rule      | Owner | Approval | NOTES
6300    | Sales & Marketing             | Marketing     | (Mixed)               | GL=6300        | CMO   | >$5000  | MOVE TO 8000s
6310    | Advertising                   | Marketing     | Digital Marketing     | GL=6310,FUTURE:8000 | CMO | >$5000 | MOVE TO 8000
```

---

## 🔧 Phase 2: Create Auto-Classification Rules (Column U)

### Rule Syntax

Use these patterns in the **Auto_Rule** column:

#### 1. GL Code Match (Most Common)
```
GL=4100              // Exact GL code match
GL=7200,GL=7210      // Multiple GL codes (OR logic)
```

#### 2. Vendor Pattern Match
```
VENDOR~contractor                    // Contains "contractor" (case-insensitive)
VENDOR~"Engineering Services"        // Exact phrase
VENDOR~Law|Legal|Attorney            // Any of these words (OR logic)
```

#### 3. Description Pattern Match
```
DESCR~certification                  // Description contains "certification"
DESCR~prototype|proto|sample         // Contains any of these words
DESCR~"safety testing"               // Exact phrase in description
```

#### 4. Amount Range
```
AMOUNT>10000                         // Greater than $10,000
AMOUNT<5000                          // Less than $5,000
AMOUNT:5000-10000                    // Between $5,000 and $10,000
```

#### 5. Combined Rules (AND logic)
```
GL=5110,VENDOR~Compal                        // GL code AND vendor
GL=6120,DESCR~UL|FCC|CE,AMOUNT>2500         // GL AND description AND amount
VENDOR~contractor,DESCR~engineering          // Vendor AND description
```

### Real-World Examples

```
Account: 7200 (Engineering Contractors)
Rule: VENDOR~contractor,VENDOR~engineer,DESCR~engineering,DESCR~1099

Account: 9110 (Safety Certifications)  
Rule: DESCR~certification,DESCR~UL,DESCR~FCC,DESCR~CE,DESCR~testing,VENDOR~lab

Account: 5110 (ODM Purchases)
Rule: VENDOR~Compal,VENDOR~Foxconn,VENDOR~ODM,DESCR~manufacturing

Account: 6200 (Rent)
Rule: VENDOR~landlord,VENDOR~property,DESCR~rent,DESCR~lease

Account: 8000 (Online Advertising)
Rule: VENDOR~Google,VENDOR~Facebook,VENDOR~Meta,DESCR~ads,DESCR~advertising
```

---

## 🎯 Phase 3: Create New Account Numbers

### New Labor Accounts (7000s Range)

**Add these to your Chart of Accounts:**

```
NUMBER | NAME                              | ACCOUNT TYPE | DETAIL TYPE      | BOSS_CAT | BOSS_SUBCAT        | AUTO_RULE
7000   | Labor Expenses                    | Expense      | Payroll Expenses | Labor    | (Parent)           | GL=7000
7010   | Salaries - Engineering            | Expense      | Payroll Expenses | Labor    | Payroll (W2)       | GL=7010,DEPT=Engineering
7020   | Salaries - Operations             | Expense      | Payroll Expenses | Labor    | Payroll (W2)       | GL=7020,DEPT=Operations
7030   | Salaries - G&A                    | Expense      | Payroll Expenses | Labor    | Payroll (W2)       | GL=7030,DEPT=Admin
7040   | Salaries - Sales/Marketing        | Expense      | Payroll Expenses | Labor    | Payroll (W2)       | GL=7040,DEPT=Marketing
7100   | Payroll Taxes & Benefits          | Expense      | Payroll Expenses | Labor    | (Parent)           | GL=7100
7110   | FICA/Medicare                     | Expense      | Payroll Expenses | Labor    | Payroll Taxes      | GL=7110,DESCR~FICA|Medicare
7120   | State Unemployment                | Expense      | Payroll Expenses | Labor    | Payroll Taxes      | GL=7120,DESCR~SUTA|SUI
7130   | Federal Unemployment              | Expense      | Payroll Expenses | Labor    | Payroll Taxes      | GL=7130,DESCR~FUTA
7140   | Workers Comp Insurance            | Expense      | Payroll Expenses | Labor    | Payroll Taxes      | GL=7140,DESCR~workers comp
7150   | Health Insurance                  | Expense      | Payroll Expenses | Labor    | Benefits           | GL=7150,DESCR~health insurance
7160   | 401k Match                        | Expense      | Payroll Expenses | Labor    | Benefits           | GL=7160,DESCR~401k|retirement
7200   | Contract Labor                    | Expense      | Subcontractors   | Labor    | (Parent)           | GL=7200
7210   | Engineering Contractors           | Expense      | Subcontractors   | Labor    | Contract Labor     | GL=7210,VENDOR~contractor,DESCR~engineering
7220   | Operations Contractors            | Expense      | Subcontractors   | Labor    | Contract Labor     | GL=7220,VENDOR~contractor,DESCR~operations
7230   | Marketing Contractors             | Expense      | Subcontractors   | Labor    | Contract Labor     | GL=7230,VENDOR~contractor,DESCR~marketing
7240   | Administrative Contractors        | Expense      | Subcontractors   | Labor    | Contract Labor     | GL=7240,VENDOR~contractor,DESCR~admin
```

### New NRE Accounts (9000s Range)

**Add these to your Chart of Accounts:**

```
NUMBER | NAME                              | ACCOUNT TYPE | DETAIL TYPE      | BOSS_CAT | BOSS_SUBCAT           | AUTO_RULE
9000   | Non-Recurring Engineering (NRE)   | Expense      | R&D              | NRE      | (Parent)              | GL=9000
9010   | R&D Labor                         | Expense      | R&D              | NRE      | R&D Personnel         | GL=9010,DESCR~R&D|research
9020   | Engineering Design                | Expense      | R&D              | NRE      | Engineering Services  | GL=9020,DESCR~design
9030   | Prototyping Materials             | Expense      | R&D              | NRE      | Prototyping           | GL=9030,DESCR~prototype,DESCR~material
9040   | Prototyping Services              | Expense      | R&D              | NRE      | Prototyping           | GL=9040,DESCR~prototype,VENDOR~prototype
9100   | Testing & Certification           | Expense      | R&D              | NRE      | (Parent)              | GL=9100
9110   | Safety Certifications             | Expense      | R&D              | NRE      | Certifications        | GL=9110,DESCR~UL|FCC|CE|certification
9120   | Compliance Testing                | Expense      | R&D              | NRE      | Testing & Validation  | GL=9120,DESCR~compliance|testing
9130   | Lab Services                      | Expense      | R&D              | NRE      | Testing & Validation  | GL=9130,DESCR~lab,VENDOR~lab
9200   | Tooling & Equipment               | Expense      | R&D              | NRE      | (Parent)              | GL=9200
9210   | Mold Design                       | Expense      | R&D              | NRE      | Tooling               | GL=9210,DESCR~mold,DESCR~design
9220   | Mold Manufacturing                | Expense      | R&D              | NRE      | Tooling               | GL=9220,DESCR~mold,DESCR~manufacturing
9230   | Fixtures & Test Equipment         | Expense      | R&D              | NRE      | Tooling               | GL=9230,DESCR~fixture|jig|test equipment
9300   | NRE Services                      | Expense      | R&D              | NRE      | (Parent)              | GL=9300
9310   | Engineering Consultants           | Expense      | R&D              | NRE      | Engineering Services  | GL=9310,VENDOR~consultant,DESCR~engineering
9320   | Technical Documentation           | Expense      | R&D              | NRE      | Engineering Services  | GL=9320,DESCR~documentation|manual
9330   | Patent & IP Services              | Expense      | R&D              | NRE      | Engineering Services  | GL=9330,DESCR~patent|IP|intellectual
```

### New Marketing Accounts (8000s Range)

**Add these to your Chart of Accounts:**

```
NUMBER | NAME                              | ACCOUNT TYPE | DETAIL TYPE          | BOSS_CAT  | BOSS_SUBCAT       | AUTO_RULE
8000   | Marketing Expenses                | Expense      | Advertising          | Marketing | (Parent)          | GL=8000
8010   | Online Advertising                | Expense      | Advertising          | Marketing | Digital Marketing | GL=8010,VENDOR~Google|Facebook|Meta
8020   | SEO/SEM Services                  | Expense      | Advertising          | Marketing | Digital Marketing | GL=8020,DESCR~SEO|SEM|search
8030   | Social Media Marketing            | Expense      | Advertising          | Marketing | Digital Marketing | GL=8030,DESCR~social media
8100   | Traditional Marketing             | Expense      | Advertising          | Marketing | (Parent)          | GL=8100
8110   | Trade Shows                       | Expense      | Advertising          | Marketing | Trade Shows       | GL=8110,DESCR~trade show|expo|conference
8120   | Print Advertising                 | Expense      | Advertising          | Marketing | Traditional       | GL=8120,DESCR~print|magazine|newspaper
8130   | Marketing Materials               | Expense      | Advertising          | Marketing | Marketing Materials| GL=8130,DESCR~brochure|flyer|material
8200   | Marketing Agency & Professional   | Expense      | Advertising          | Marketing | (Parent)          | GL=8200
8210   | Marketing Agency Fees             | Expense      | Advertising          | Marketing | Agency Fees       | GL=8210,VENDOR~agency,DESCR~marketing
8220   | Design Services                   | Expense      | Advertising          | Marketing | Agency Fees       | GL=8220,VENDOR~designer,DESCR~design
8230   | PR Services                       | Expense      | Advertising          | Marketing | Agency Fees       | GL=8230,DESCR~PR|public relations
```

---

## 💾 Phase 4: Export Mapping Table for BOSS Portal

### Create GL Code Mapping CSV

**In Excel, create a new sheet called "BOSS_Mappings":**

**Columns:**
- gl_account_code
- gl_account_name
- boss_category
- boss_sub_category
- auto_classification_rule
- category_owner
- approval_threshold
- effective_date

**Sample CSV Export (Save as: `gl_code_boss_mappings.csv`):**

```csv
gl_account_code,gl_account_name,boss_category,boss_sub_category,auto_classification_rule,category_owner,approval_threshold,effective_date
4100,Product Sales - DTC,Revenue,D2C,GL=4100,CFO,,2025-01-01
4210,Amazon,Revenue,D2C,GL=4210,CFO,,2025-01-01
4220,Shopify,Revenue,D2C,GL=4220,CFO,,2025-01-01
5110,ODM Purchases / Manufacturing,Inventory,Finished Goods,GL=5110,COO,>$10000,2025-01-01
5200,Freight & Shipping,Inventory,Freight & Shipping,GL=5200,COO,,2025-01-01
6200,Rent,OpEx,Rent & Facilities,GL=6200,CFO,Always,2025-01-01
6400,Software Subscriptions,OpEx,Annual Subscriptions,GL=6400,CTO,>$1000,2025-01-01
7210,Engineering Contractors,Labor,Contract Labor,GL=7210|VENDOR~contractor,COO,>$5000,2025-01-01
9110,Safety Certifications,NRE,Certifications,GL=9110|DESCR~UL|FCC|CE,CTO,>$2500,2025-01-01
8010,Online Advertising,Marketing,Digital Marketing,GL=8010|VENDOR~Google|Facebook,CMO,>$5000,2025-01-01
```

---

## 🔄 Phase 5: Import to BOSS Portal

### Option A: SQL Import (For Database)

```sql
-- Create gl_code_mappings table (if not exists)
CREATE TABLE IF NOT EXISTS gl_code_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gl_account_code TEXT NOT NULL UNIQUE,
  gl_account_name TEXT,
  boss_category TEXT NOT NULL,
  boss_sub_category TEXT,
  auto_classification_rule TEXT,
  category_owner TEXT,
  approval_threshold TEXT,
  effective_date DATE DEFAULT CURRENT_DATE,
  expires_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Import from CSV (using Supabase or psql)
COPY gl_code_mappings (
  gl_account_code, 
  gl_account_name, 
  boss_category, 
  boss_sub_category,
  auto_classification_rule,
  category_owner,
  approval_threshold,
  effective_date
)
FROM '/path/to/gl_code_boss_mappings.csv'
CSV HEADER;
```

### Option B: API Import (Using BOSS Portal)

Create an import page at: `Admin > GL Management > Import Mappings`

**Upload your CSV and the system will:**
1. Validate GL codes against QuickBooks data
2. Check for duplicate mappings
3. Preview changes before applying
4. Import with audit trail

---

## 📊 Phase 6: Test & Validate

### Test Checklist

**1. Revenue Classification Test** ✅
```
□ Create test transaction: GL 4100 (Product Sales - DTC)
□ Verify BOSS auto-classifies as: Revenue > D2C
□ Check Cash Flow Runway displays correctly
```

**2. Labor Classification Test** ✅
```
□ Create test transaction: GL 7210 (Engineering Contractors)
□ Verify BOSS auto-classifies as: Labor > Contract Labor
□ Check Cash Flow Runway "GL Labor" section displays correctly
```

**3. NRE Classification Test** ✅
```
□ Create test transaction: GL 9110 (Safety Certifications)
□ Verify BOSS auto-classifies as: NRE > Certifications
□ Check NRE Summary page includes this transaction
□ Verify NRE Paid/Owed/Past Due cards update correctly
```

**4. Auto-Rule Pattern Match Test** ✅
```
□ Create transaction with VENDOR="ABC Contractor", no GL code
□ Verify system suggests: Labor > Contract Labor
□ Confidence score should be >70%
```

**5. Override System Test** ✅
```
□ Manually override a transaction to different category
□ Verify override saves to gl_transaction_overrides table
□ Check override displays in Rosetta Project page
□ Verify override persists across reloads
```

---

## 🎯 Success Criteria

### You'll know it's working when:

✅ **Cash Flow Runway Page:**
- "Load GL Labor" button shows data immediately
- "Load GL Revenue" shows D2C vs B2B breakdown
- "Load GL NRE" shows all certification & prototyping costs
- Week dates align perfectly (no more 0's)

✅ **Rosetta Project Page:**
- QB Data Range shows correct date span
- Most transactions show BOSS category automatically
- Override count drops from 148+ to <20
- Filter by category works correctly

✅ **NRE Summary Page:**
- NRE Paid/Owed/Past Due cards show accurate totals
- Date range filter updates cards correctly
- All certification expenses included

✅ **Reports:**
- Can export clean data by BOSS category
- GL comparison charts show minimal variance
- Category summaries reconcile with QuickBooks

---

## 🚀 Quick Start Commands

### Generate Sample Mappings in Python

```python
import pandas as pd

# Sample mapping data
mappings = [
    {"code": "4100", "name": "Product Sales - DTC", "boss_cat": "Revenue", "boss_sub": "D2C"},
    {"code": "4210", "name": "Amazon", "boss_cat": "Revenue", "boss_sub": "D2C"},
    {"code": "5110", "name": "ODM Purchases", "boss_cat": "Inventory", "boss_sub": "Finished Goods"},
    {"code": "7210", "name": "Engineering Contractors", "boss_cat": "Labor", "boss_sub": "Contract Labor"},
    {"code": "9110", "name": "Safety Certifications", "boss_cat": "NRE", "boss_sub": "Certifications"},
]

df = pd.DataFrame(mappings)
df.to_csv("gl_mappings_initial.csv", index=False)
print("✓ Sample mappings exported to gl_mappings_initial.csv")
```

### Validate Your Excel File Structure

```python
import pandas as pd

# Read your Chart of Accounts
df = pd.read_excel("Proposed Chart of Accounts Changes _ vDraft2.xlsx")

# Check for BOSS columns
required_cols = ["BOSS_Category", "BOSS_SubCategory", "Auto_Rule"]
missing = [col for col in required_cols if col not in df.columns]

if missing:
    print(f"⚠️  Missing columns: {missing}")
    print("Add these columns and re-run validation")
else:
    print("✅ All BOSS mapping columns present")
    
    # Check for unmapped accounts
    unmapped = df[df["BOSS_Category"].isna()]
    print(f"\n📊 Mapping Status:")
    print(f"  Total accounts: {len(df)}")
    print(f"  Mapped: {len(df) - len(unmapped)}")
    print(f"  Unmapped: {len(unmapped)}")
    
    if len(unmapped) > 0:
        print(f"\n⚠️  Unmapped accounts:")
        print(unmapped[["Number", "Name"]].head(10))
```

---

## 📞 Need Help?

### Common Issues & Solutions

**Issue:** "Auto-classification not working"
- ✓ Check Auto_Rule syntax (no typos)
- ✓ Verify GL codes match exactly
- ✓ Check vendor/description patterns are case-insensitive
- ✓ Review classification rules priority order

**Issue:** "Cash Flow Runway shows 0's"
- ✓ Verify date range is set
- ✓ Check week date alignment (Monday start)
- ✓ Confirm transactions exist in date range
- ✓ Verify BOSS category mappings are active

**Issue:** "Too many manual overrides still needed"
- ✓ Review most common override patterns
- ✓ Update Auto_Rule for those GL codes
- ✓ Add vendor pattern matching
- ✓ Consider creating new sub-accounts

---

## ✅ Final Checklist

**Before Going Live:**
```
□ All columns S-W added to Excel file
□ At least 80% of accounts have BOSS category mappings
□ Labor accounts (7200s) created in QuickBooks
□ NRE accounts (9100s) created in QuickBooks
□ Marketing accounts (8000s) created (optional Phase 3)
□ Mapping CSV exported and tested
□ BOSS portal GL APIs updated with new codes
□ Test transactions verified in all three pages
□ Team trained on new account structure
□ Documentation updated
□ Backup of old Chart of Accounts saved
```

**You're Ready! 🎉**

---

**Next:** Review `Section_4_vs_Actual_CoA_Comparison.md` for detailed analysis

