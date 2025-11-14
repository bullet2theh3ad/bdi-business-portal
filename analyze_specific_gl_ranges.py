#!/usr/bin/env python3
"""
Analyze specific GL code ranges for NRE, Fixed Assets, Depreciation, and Payroll Liabilities
"""

import json
import pandas as pd

# Load the analysis JSON
with open('/Users/Steve/Projects/BDI/BDI PORTAL/Proposed Chart of Accounts Changes _ vDraft2_analysis.json', 'r') as f:
    data = json.load(f)

accounts = data['account_data'][1:]  # Skip header row

# Define the ranges we're analyzing
ranges_to_analyze = {
    'Fixed Assets (1500-1700)': (1500, 1700),
    'Payroll Liabilities (2320-2325)': (2320, 2325),
    'OPEX - Product (6110-6190)': (6110, 6190),
    'Depreciation (7100-7190)': (7100, 7190)
}

print("=" * 100)
print("DETAILED ANALYSIS OF SPECIFIC GL CODE RANGES")
print("=" * 100)
print()

for range_name, (min_code, max_code) in ranges_to_analyze.items():
    print("\n" + "=" * 100)
    print(f"📊 {range_name}")
    print("=" * 100)
    
    # Extract accounts in this range
    range_accounts = []
    for account in accounts:
        try:
            acct_num = int(str(account['Unnamed: 0']).split('.')[0])
            if min_code <= acct_num <= max_code:
                range_accounts.append({
                    'Number': acct_num,
                    'Name': account['Unnamed: 1'],
                    'Account_Type': account['Unnamed: 2'],
                    'Detail_Type': account['Unnamed: 3'],
                    'Description': account['Unnamed: 4']
                })
        except (ValueError, KeyError):
            continue
    
    if range_accounts:
        print(f"\n✓ Found {len(range_accounts)} accounts in this range:\n")
        for acct in range_accounts:
            print(f"  {acct['Number']}: {acct['Name']}")
            print(f"      Type: {acct['Account_Type']}")
            print(f"      Detail: {acct['Detail_Type']}")
            if acct['Description'] and acct['Description'] != '':
                desc = str(acct['Description'])[:150]
                print(f"      Description: {desc}...")
            print()
    else:
        print(f"\n⚠️  No accounts found in this range")

# Now let's look at BOSS NRE categories for reference
print("\n" + "=" * 100)
print("🎯 BOSS NRE ANALYSIS PAGE CATEGORIES (For Reference)")
print("=" * 100)
print("""
Based on BOSS portal NRE Summary implementation, you currently track NRE as:

BOSS NRE Categories:
  • Certifications (UL, FCC, CE, Safety testing)
  • Firmware Development (FW)
  • DevOps (AWS, Infrastructure, Support) ← SHOULD BE MOVED TO OPEX
  • Prototyping (Materials, Services)
  • Tooling (Molds, Fixtures) ← CAN BE CAPITALIZED/DEPRECIATED
  • Testing & Validation
  • Engineering Services (Consultants, Design)
  • R&D Labor

Current Issue: DevOps is mixed with NRE but should be OpEx
""")

# Recommendations
print("\n" + "=" * 100)
print("💡 RECOMMENDATIONS BY CATEGORY")
print("=" * 100)

print("""
╔════════════════════════════════════════════════════════════════════════════╗
║ 1. FIXED ASSETS (1500-1700) - NRE CAPITALIZATION                          ║
╚════════════════════════════════════════════════════════════════════════════╝

GAAP RULES FOR NRE CAPITALIZATION:

✅ CAN BE CAPITALIZED (Balance Sheet - Fixed Assets):
   • Tooling & Molds (if useful life > 1 year and cost > $2,500)
   • Manufacturing Equipment
   • Test Equipment & Fixtures (if reusable)
   • Product Development Costs (ONLY after technological feasibility established)
   
❌ MUST BE EXPENSED (Income Statement - R&D Expense):
   • Research activities (pre-feasibility)
   • Certifications (UL, FCC, CE) - always expense
   • Testing & Validation - always expense
   • Engineering Consultants - always expense
   • Firmware Development - expense unless meeting specific criteria
   • Most prototyping costs - expense

RECOMMENDED FIXED ASSET ACCOUNTS FOR NRE:

1500 - Fixed Assets - NRE
1510 - Tooling & Molds (Capitalized)
1520 - Manufacturing Equipment (Capitalized)
1530 - Test Equipment & Fixtures (Capitalized)
1540 - Product Development Costs (Capitalized - post-feasibility)
1590 - Accumulated Depreciation - NRE Tooling (Contra-Asset)
1595 - Accumulated Depreciation - NRE Equipment (Contra-Asset)

DEPRECIATION METHOD (GAAP):
• Tooling/Molds: 3-7 years straight-line (or units of production)
• Equipment: 5-7 years straight-line
• Product Development: Over expected product life (typically 3-5 years)

╔════════════════════════════════════════════════════════════════════════════╗
║ 2. DEPRECIATION (7100-7190) - SHOULD MOVE TO 9600s                        ║
╚════════════════════════════════════════════════════════════════════════════╝

CURRENT PROBLEM: Depreciation mixed with other operating expenses

GAAP BEST PRACTICE: Depreciation should be in "Other Expenses" section

RECOMMENDED STRUCTURE:

9600 - Depreciation & Amortization
9610 - Depreciation - Tooling & Molds
9620 - Depreciation - Manufacturing Equipment
9630 - Depreciation - Test Equipment
9640 - Depreciation - Office Equipment
9650 - Depreciation - Vehicles
9660 - Depreciation - Leasehold Improvements
9670 - Amortization - Intangible Assets

INCOME STATEMENT PRESENTATION:
Operating Income
  Less: Other Expenses
    - Depreciation & Amortization (9600s)
    - Interest Expense (9500s)
= Net Income

╔════════════════════════════════════════════════════════════════════════════╗
║ 3. OPEX - PRODUCT (6110-6190) - SPLIT NRE vs DEVOPS                       ║
╚════════════════════════════════════════════════════════════════════════════╝

CRITICAL DISTINCTION: NRE vs DevOps

🔬 NRE (Research & Development) - GAAP Category: "R&D Expense"
   Purpose: Creating NEW products or significantly improving existing ones
   Examples:
   • New product design & engineering
   • Prototyping for NEW product
   • Certifications for NEW product
   • Testing NEW product features
   • Engineering consultants for product development
   
   GAAP: Shows as "Operating Expenses - Research & Development"
   BOSS: NRE category
   TAX: Qualifies for R&D tax credits

⚙️ DEVOPS (Operations) - GAAP Category: "Operating Expense - G&A"
   Purpose: Maintaining and operating EXISTING infrastructure
   Examples:
   • AWS/Azure hosting (ongoing)
   • DevOps engineer salaries (maintenance)
   • Infrastructure support & monitoring
   • CI/CD pipeline maintenance
   • Server maintenance
   • Application hosting
   • IT infrastructure support
   
   GAAP: Shows as "Operating Expenses - General & Administrative"
   BOSS: OpEx category
   TAX: Regular business expense (not R&D)

HOW TECH COMPANIES CATEGORIZE:

Tech Company Best Practice:
┌─────────────────────────────────────────────────────────┐
│ R&D (NRE):                                              │
│ • New product development                               │
│ • New feature development (major enhancements)          │
│ • Engineering for NEW capabilities                      │
│                                                          │
│ Operating Expense (DevOps):                             │
│ • Infrastructure hosting (AWS, Azure)                   │
│ • Operational support                                   │
│ • Maintenance of existing systems                       │
│ • BAU (Business As Usual) IT operations                 │
└─────────────────────────────────────────────────────────┘

RECOMMENDED SPLIT:

MOVE TO R&D (9000s):
6110 → 9010 - Product Engineering & Design
6120 → 9110 - Product Certifications (UL, FCC, CE)
6130 → 9120 - Compliance & Testing
(Any account related to NEW product development)

KEEP IN OPEX (6000s) OR CREATE NEW:
6XXX → 6500 - DevOps & Infrastructure
6XXX → 6510 - AWS / Cloud Hosting
6XXX → 6520 - Infrastructure Support
6XXX → 6530 - Application Hosting
6XXX → 6540 - CI/CD & Development Tools

╔════════════════════════════════════════════════════════════════════════════╗
║ 4. PAYROLL LIABILITIES (2320-2325) - GAAP COMPLIANCE CHECK                ║
╚════════════════════════════════════════════════════════════════════════════╝

GAAP-COMPLIANT PAYROLL LIABILITY STRUCTURE:

Current Liabilities - Payroll Related (2300s range is appropriate)

REQUIRED ACCOUNTS (GAAP):

2310 - Salaries & Wages Payable (accrued, unpaid)
2320 - Payroll Tax Liabilities (employer portion)
2325 - Employee Payroll Deductions Payable (withheld from employees)
2330 - Accrued Paid Time Off (PTO/Vacation)
2340 - Accrued Bonuses
2350 - 401(k) Employer Match Payable
2360 - Health Insurance Premiums Payable
2370 - Workers Compensation Insurance Payable
2380 - Garnishments Payable (court-ordered)

BREAKDOWN BY TYPE:

Employer Liabilities (Company owes):
• 2320 - FICA/Medicare (employer portion)
• 2321 - Federal Unemployment Tax (FUTA)
• 2322 - State Unemployment Tax (SUTA)
• 2350 - 401(k) Match
• 2360 - Health Insurance (employer portion)

Employee Withholdings (Held in trust for employees):
• 2325 - Federal Income Tax Withheld
• 2326 - State Income Tax Withheld
• 2327 - FICA/Medicare (employee portion)
• 2328 - 401(k) Employee Deferrals
• 2329 - Health Insurance (employee portion)

GAAP COMPLIANCE: ✅
The 2320-2325 range is appropriate for payroll liabilities
Ensure each type of liability is properly separated for accurate reporting

╔════════════════════════════════════════════════════════════════════════════╗
║ 5. MAPPING TO BOSS PORTAL CATEGORIES                                      ║
╚════════════════════════════════════════════════════════════════════════════╝

RECOMMENDED MAPPING:

Fixed Assets (1500-1700):
  1510-1540 → BOSS: NRE (but Balance Sheet, not P&L)
  1590-1595 → BOSS: Other (Contra-Asset)

Payroll Liabilities (2320-2325):
  All → BOSS: Not applicable (Balance Sheet)

OPEX - Product (6110-6190):
  6110-6190 (Product Development) → BOSS: NRE → Move to 9000s
  NEW 6500-6540 (DevOps) → BOSS: OpEx (keep in 6000s)

Depreciation (7100-7190):
  7100-7190 → BOSS: Other → Move to 9600s
  7110 (Tooling Depreciation) → BOSS: NRE-related but keep as "Other"
""")

print("\n" + "=" * 100)
print("📋 SUMMARY ACTION ITEMS")
print("=" * 100)
print("""
PRIORITY 1 - IMMEDIATE:
□ Create 1510-1540 Fixed Asset accounts for capitalized NRE (Tooling, Equipment)
□ Create 1590-1595 Accumulated Depreciation accounts (contra-assets)
□ Create 6500-6540 DevOps/Infrastructure OpEx accounts
□ Move 6110-6190 product development items to 9000s R&D range

PRIORITY 2 - THIS MONTH:
□ Move 7100-7190 Depreciation accounts to 9600s range
□ Create 9610-9670 Depreciation by asset type accounts
□ Review 2320-2325 Payroll Liabilities and expand if needed
□ Document capitalization policy (what gets capitalized vs expensed)

PRIORITY 3 - ONGOING:
□ Train team on NRE vs DevOps distinction
□ Update BOSS portal NRE page to remove DevOps category
□ Create approval workflow for capitalizing NRE costs
□ Annual review of capitalized NRE asset useful lives

TAX CONSIDERATIONS:
• R&D Tax Credits: Only NRE (not DevOps) qualifies
• Depreciation: Accelerate under Section 179 or Bonus Depreciation if eligible
• Capitalized costs reduce current year deductions but provide future depreciation
""")

print("\n" + "=" * 100)
print("✅ ANALYSIS COMPLETE")
print("=" * 100)

