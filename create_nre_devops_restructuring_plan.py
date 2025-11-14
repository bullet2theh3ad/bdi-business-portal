#!/usr/bin/env python3
"""
Create detailed NRE/DevOps restructuring plan with specific account recommendations
"""

import pandas as pd
import json

output_file = "/Users/Steve/Projects/BDI/BDI PORTAL/NRE_DevOps_Restructuring_Plan.xlsx"

print("=" * 80)
print("CREATING NRE/DEVOPS RESTRUCTURING PLAN")
print("=" * 80)
print()

writer = pd.ExcelWriter(output_file, engine='openpyxl')

# ============================================================================
# SHEET 1: EXECUTIVE SUMMARY
# ============================================================================
print("📊 Creating Sheet 1: Executive Summary...")

summary_data = {
    'Key Finding': [
        'NRE vs DevOps Misclassification',
        'Fixed Assets Structure',
        'Depreciation Location',
        'Payroll Liabilities',
        'GAAP Compliance',
        'R&D Tax Credit Impact'
    ],
    'Current State': [
        'DevOps mixed with NRE in 1550s and BOSS portal',
        '26 accounts in 1500-1700, mostly well-structured',
        'Depreciation in 7100s (wrong location per GAAP)',
        '6 accounts in 2320-2325 (adequate but could expand)',
        '85% compliant, needs separation of R&D vs G&A',
        'DevOps incorrectly included in R&D tracking'
    ],
    'Recommended State': [
        'DevOps → OpEx (6500s), NRE → R&D (9000s)',
        'Keep 1500-1700 structure, refine categories',
        'Move depreciation to 9600s per GAAP',
        'Expand to 2310-2380 for full payroll detail',
        '100% GAAP compliant with proper functional expense classification',
        'Only true R&D qualifies, increasing tax credit accuracy'
    ],
    'Priority': [
        '🔴 HIGH',
        '🟡 MEDIUM',
        '🟡 MEDIUM',
        '🟢 LOW',
        '🔴 HIGH',
        '🔴 HIGH'
    ]
}

df_summary = pd.DataFrame(summary_data)
df_summary.to_excel(writer, sheet_name='1_Executive_Summary', index=False)

# ============================================================================
# SHEET 2: NRE CAPITALIZATION RULES (GAAP)
# ============================================================================
print("📊 Creating Sheet 2: NRE Capitalization Rules...")

capitalization_rules = {
    'NRE Category': [
        'Tooling & Molds',
        'Tooling & Molds',
        'Manufacturing Equipment',
        'Test Equipment',
        'Product Development Software',
        'Product Development Software',
        'Certifications',
        'Testing & Validation',
        'Prototyping',
        'Engineering Consultants',
        'Firmware Development',
        'Firmware Development'
    ],
    'Scenario': [
        'Cost > $2,500, useful life > 1 year',
        'Cost < $2,500 or single-use',
        'Production equipment, useful life > 1 year',
        'Reusable test fixtures',
        'After technological feasibility established',
        'Before technological feasibility',
        'UL, FCC, CE, Safety testing (all)',
        'Product testing, QA (all)',
        'Prototype materials & services',
        'R&D consulting services',
        'Commercial product firmware',
        'Internal tools/prototypes'
    ],
    'Capitalize or Expense': [
        '✅ CAPITALIZE',
        '❌ EXPENSE',
        '✅ CAPITALIZE',
        '✅ CAPITALIZE',
        '✅ CAPITALIZE',
        '❌ EXPENSE',
        '❌ EXPENSE (always)',
        '❌ EXPENSE (always)',
        '❌ EXPENSE',
        '❌ EXPENSE',
        '✅ MAY CAPITALIZE',
        '❌ EXPENSE'
    ],
    'Target_Fixed_Asset_Account': [
        '1510 - Tooling & Molds',
        'N/A (goes to 9200s R&D Expense)',
        '1520 - Production Assets',
        '1530 - Test Equipment',
        '1540 - Product Development Software',
        'N/A (goes to 9000s R&D Expense)',
        'N/A (goes to 9110 - Certifications)',
        'N/A (goes to 9120 - Testing)',
        'N/A (goes to 9220 - Prototyping)',
        'N/A (goes to 9310 - Eng Consulting)',
        '1540 - Product Dev Software',
        'N/A (goes to 9000s R&D Expense)'
    ],
    'Depreciation_Period': [
        '3-7 years (straight-line or units-of-production)',
        'N/A',
        '5-7 years (straight-line)',
        '5 years (straight-line)',
        '3-5 years (product life)',
        'N/A',
        'N/A',
        'N/A',
        'N/A',
        'N/A',
        '3-5 years (product life)',
        'N/A'
    ],
    'R&D_Tax_Credit_Eligible': [
        'No (capitalized)',
        'Yes',
        'No (capitalized)',
        'No (capitalized)',
        'No (capitalized)',
        'Yes',
        'Yes',
        'Yes',
        'Yes',
        'Yes',
        'Depends (consult tax advisor)',
        'Yes'
    ]
}

df_cap_rules = pd.DataFrame(capitalization_rules)
df_cap_rules.to_excel(writer, sheet_name='2_Capitalization_Rules', index=False)

# ============================================================================
# SHEET 3: NRE vs DEVOPS DISTINCTION
# ============================================================================
print("📊 Creating Sheet 3: NRE vs DevOps Distinction...")

nre_devops_distinction = {
    'Expense Type': [
        # NRE Examples
        'New product circuit board design', 'New product mechanical design', 
        'New product firmware (initial dev)', 'Product certification testing',
        'Prototype materials for NEW product', 'Engineering consultant for NEW feature',
        'Safety testing for NEW product', 'FCC/CE certification',
        
        # DevOps Examples
        'AWS EC2 hosting (monthly)', 'Azure cloud storage (monthly)',
        'DevOps engineer salary', 'CI/CD pipeline maintenance',
        'Server monitoring tools', 'Application hosting (ongoing)',
        'Infrastructure support', 'Database hosting (monthly)',
        'CDN services', 'Load balancer costs'
    ],
    'Category': [
        'NRE', 'NRE', 'NRE', 'NRE', 'NRE', 'NRE', 'NRE', 'NRE',
        'DevOps', 'DevOps', 'DevOps', 'DevOps', 'DevOps', 'DevOps', 'DevOps', 'DevOps', 'DevOps', 'DevOps'
    ],
    'GAAP_Functional_Category': [
        'R&D', 'R&D', 'R&D', 'R&D', 'R&D', 'R&D', 'R&D', 'R&D',
        'G&A', 'G&A', 'G&A', 'G&A', 'G&A', 'G&A', 'G&A', 'G&A', 'G&A', 'G&A'
    ],
    'BOSS_Category': [
        'NRE', 'NRE', 'NRE', 'NRE', 'NRE', 'NRE', 'NRE', 'NRE',
        'OpEx', 'OpEx', 'OpEx', 'OpEx', 'OpEx', 'OpEx', 'OpEx', 'OpEx', 'OpEx', 'OpEx'
    ],
    'New_GL_Account': [
        '9010 - Product Engineering', '9010 - Product Engineering',
        '9020 - Firmware Dev', '9110 - Certifications',
        '9220 - Prototyping', '9310 - Engineering Consulting',
        '9120 - Testing & Validation', '9110 - Certifications',
        '6510 - AWS/Cloud Hosting', '6510 - AWS/Cloud Hosting',
        '7220 - Operations Contract Labor', '6520 - Infrastructure Support',
        '6520 - Infrastructure Support', '6530 - Application Hosting',
        '6520 - Infrastructure Support', '6530 - Application Hosting',
        '6530 - Application Hosting', '6530 - Application Hosting'
    ],
    'R&D_Tax_Credit': [
        'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes',
        'No', 'No', 'No', 'No', 'No', 'No', 'No', 'No', 'No', 'No'
    ],
    'Key_Differentiator': [
        'Creates NEW product', 'Creates NEW product', 'Creates NEW capability',
        'Required for NEW product', 'NEW product development', 'NEW product/feature',
        'NEW product compliance', 'NEW product compliance',
        'Maintains EXISTING infrastructure', 'Maintains EXISTING infrastructure',
        'Maintains EXISTING systems', 'Maintains EXISTING systems',
        'Maintains EXISTING systems', 'Maintains EXISTING systems',
        'Maintains EXISTING systems', 'Maintains EXISTING systems',
        'Maintains EXISTING systems', 'Maintains EXISTING systems'
    ]
}

df_nre_devops = pd.DataFrame(nre_devops_distinction)
df_nre_devops.to_excel(writer, sheet_name='3_NRE_vs_DevOps', index=False)

# ============================================================================
# SHEET 4: ACCOUNT MIGRATION PLAN (6110-6190)
# ============================================================================
print("📊 Creating Sheet 4: Account Migration Plan...")

migration_plan = {
    'Current_Account': [
        '6110', '6120', '6130', '6140', '6150', '6160', '6170', '6180', '6190',
        '1550', '1551', '1552', '1553', '1554',
        '7140 (DevOps Depreciation)'
    ],
    'Current_Name': [
        'Product Licensing Fees', 'Product Certifications', 'Compliance & Registration',
        'Product Testing', 'Packaging Design & Development', 'Labeling & Barcoding',
        'Warranty & Product Support', 'Product Documentation', 
        'Contract Labor - Product & Technology',
        'DevOps (Fixed Asset)', 'Capex Application Support', 'Capex Firmware Support',
        'Capex NRE / Platform Support', 'Capex Special Projects ATEL',
        'Depreciation - DevOps'
    ],
    'Is_NRE_or_DevOps': [
        'NRE', 'NRE', 'NRE', 'NRE', 'Neither (COGS/Marketing)',
        'Neither (COGS)', 'OpEx (Customer Support)', 'NRE',
        'Mixed (needs review)',
        'DEVOPS', 'DEVOPS', 'NRE (could be capitalized)', 'Mixed',
        'DEVOPS', 'DEVOPS'
    ],
    'Recommended_Action': [
        'Move to 9010 - R&D Licensing',
        'Move to 9110 - Certifications',
        'Move to 9120 - Compliance & Testing',
        'Move to 9120 - Testing & Validation',
        'Move to 5000s (COGS) or 8000s (Marketing)',
        'Move to 5000s (COGS)',
        'Keep in 6000s (Customer Service)',
        'Move to 9000s - R&D Documentation',
        'Split: NRE → 9000s, DevOps → 6500s',
        'Move to 6510 - Cloud Infrastructure',
        'Move to 6520 - Infrastructure Support',
        'Keep 1552 if truly capitalized, else → 9020',
        'Review & split to appropriate categories',
        'Move to 6500s - DevOps Special Projects',
        'Move to 9620 (if NRE) or delete (if OpEx)'
    ],
    'New_GL_Account': [
        '9010', '9110', '9120', '9120', '5XXX or 8XXX',
        '5XXX', '6XXX', '9030', '9000s or 6500s',
        '6510', '6520', '1552 or 9020', 'TBD', '6540', 'Delete or 9620'
    ],
    'Priority': [
        '🔴 HIGH', '🔴 HIGH', '🔴 HIGH', '🔴 HIGH', '🟡 MEDIUM',
        '🟡 MEDIUM', '🟢 LOW', '🟡 MEDIUM', '🔴 HIGH',
        '🔴 HIGH', '🔴 HIGH', '🟡 MEDIUM', '🟡 MEDIUM', '🔴 HIGH', '🟡 MEDIUM'
    ],
    'Impact_on_R&D_Tax_Credit': [
        'Retains eligibility', 'Retains eligibility', 'Retains eligibility',
        'Retains eligibility', 'N/A', 'N/A', 'N/A', 'Retains eligibility',
        'Critical - only NRE portion eligible',
        'Removes from R&D (correct)', 'Removes from R&D (correct)',
        'Needs review', 'Needs review', 'Removes from R&D (correct)',
        'Removes from R&D (correct)'
    ]
}

df_migration = pd.DataFrame(migration_plan)
df_migration.to_excel(writer, sheet_name='4_Account_Migration', index=False)

# ============================================================================
# SHEET 5: NEW ACCOUNT STRUCTURE (9000s R&D)
# ============================================================================
print("📊 Creating Sheet 5: New R&D Account Structure...")

new_rd_accounts = {
    'New_Account': [
        '9000', '9010', '9020', '9030',
        '9100', '9110', '9120', '9130',
        '9200', '9210', '9220', '9230',
        '9300', '9310', '9320', '9330'
    ],
    'Account_Name': [
        'Research & Development (Parent)',
        'Product Engineering & Design',
        'Firmware Development',
        'R&D Documentation & Specifications',
        
        'Product Compliance (Parent)',
        'Product Certifications (UL, FCC, CE)',
        'Compliance Testing & Validation',
        'Regulatory & Registration Fees',
        
        'Prototyping & Tooling (Parent)',
        'Mold Design & Engineering',
        'Prototype Materials & Services',
        'Test Fixtures & Jigs (expensed)',
        
        'R&D Services (Parent)',
        'Engineering Consultants',
        'Technical Documentation Services',
        'R&D Contract Labor'
    ],
    'Detail_Type': [
        'Research & Development', 'Research & Development', 'Research & Development', 'Research & Development',
        'Research & Development', 'Research & Development', 'Research & Development', 'Research & Development',
        'Research & Development', 'Research & Development', 'Research & Development', 'Research & Development',
        'Research & Development', 'Contract Labor', 'Legal & Professional Fees', 'Contract Labor'
    ],
    'BOSS_Category': [
        'NRE', 'NRE', 'NRE', 'NRE',
        'NRE', 'NRE', 'NRE', 'NRE',
        'NRE', 'NRE', 'NRE', 'NRE',
        'NRE', 'NRE', 'NRE', 'NRE'
    ],
    'BOSS_SubCategory': [
        '(Parent)', 'Engineering Services', 'Firmware', 'Engineering Services',
        '(Parent)', 'Certifications', 'Testing & Validation', 'Certifications',
        '(Parent)', 'Tooling (expensed)', 'Prototyping', 'Prototyping',
        '(Parent)', 'Engineering Services', 'Engineering Services', 'Contract Labor'
    ],
    'GAAP_Function': [
        'R&D', 'R&D', 'R&D', 'R&D',
        'R&D', 'R&D', 'R&D', 'R&D',
        'R&D', 'R&D', 'R&D', 'R&D',
        'R&D', 'R&D', 'R&D', 'R&D'
    ],
    'R&D_Tax_Credit': [
        'N/A (parent)', 'Yes', 'Yes', 'Yes',
        'N/A (parent)', 'Yes', 'Yes', 'Yes',
        'N/A (parent)', 'No (capitalize if > $2.5k)', 'Yes', 'Yes',
        'N/A (parent)', 'Yes', 'Yes', 'Yes'
    ]
}

df_new_rd = pd.DataFrame(new_rd_accounts)
df_new_rd.to_excel(writer, sheet_name='5_New_RD_Accounts', index=False)

# ============================================================================
# SHEET 6: NEW DEVOPS ACCOUNT STRUCTURE (6500s)
# ============================================================================
print("📊 Creating Sheet 6: New DevOps Account Structure...")

new_devops_accounts = {
    'New_Account': [
        '6500', '6510', '6511', '6512', '6513',
        '6520', '6521', '6522', '6523',
        '6530', '6531', '6532',
        '6540', '6541', '6542'
    ],
    'Account_Name': [
        'DevOps & Infrastructure (Parent)',
        'Cloud Hosting Services',
        'AWS Services',
        'Azure Services',
        'Other Cloud Providers',
        
        'Infrastructure Support',
        'Server Monitoring & Management',
        'CI/CD Pipeline Tools',
        'Infrastructure Automation',
        
        'Application Hosting',
        'Database Hosting',
        'CDN & Load Balancing',
        
        'DevOps Tools & Licenses',
        'Development Tools & IDEs',
        'DevOps Platforms (GitHub, GitLab, etc)'
    ],
    'Detail_Type': [
        'Office / General Administrative Expenses',
        'Office / General Administrative Expenses',
        'Office / General Administrative Expenses',
        'Office / General Administrative Expenses',
        'Office / General Administrative Expenses',
        
        'Office / General Administrative Expenses',
        'Office / General Administrative Expenses',
        'Office / General Administrative Expenses',
        'Office / General Administrative Expenses',
        
        'Office / General Administrative Expenses',
        'Office / General Administrative Expenses',
        'Office / General Administrative Expenses',
        
        'Dues & Subscriptions',
        'Dues & Subscriptions',
        'Dues & Subscriptions'
    ],
    'BOSS_Category': [
        'OpEx', 'OpEx', 'OpEx', 'OpEx', 'OpEx',
        'OpEx', 'OpEx', 'OpEx', 'OpEx',
        'OpEx', 'OpEx', 'OpEx',
        'OpEx', 'OpEx', 'OpEx'
    ],
    'BOSS_SubCategory': [
        '(Parent)', 'Services', 'Services', 'Services', 'Services',
        'Services', 'Services', 'Services', 'Services',
        'Services', 'Services', 'Services',
        'Software & Subscriptions', 'Software & Subscriptions', 'Software & Subscriptions'
    ],
    'GAAP_Function': [
        'G&A', 'G&A', 'G&A', 'G&A', 'G&A',
        'G&A', 'G&A', 'G&A', 'G&A',
        'G&A', 'G&A', 'G&A',
        'G&A', 'G&A', 'G&A'
    ],
    'R&D_Tax_Credit': [
        'No', 'No', 'No', 'No', 'No',
        'No', 'No', 'No', 'No',
        'No', 'No', 'No',
        'No', 'No', 'No'
    ],
    'Replaces_Old_Account': [
        'N/A', '1550 (DevOps Fixed Asset)', '1550', '1550', '1550',
        '1551 (Capex App Support)', '1551', '1551', '1551',
        '1553 (Platform Support)', '1553', '1553',
        '1554 (Special Projects)', '1554', '1554'
    ]
}

df_new_devops = pd.DataFrame(new_devops_accounts)
df_new_devops.to_excel(writer, sheet_name='6_New_DevOps_Accounts', index=False)

# ============================================================================
# SHEET 7: DEPRECIATION RESTRUCTURE (7100s → 9600s)
# ============================================================================
print("📊 Creating Sheet 7: Depreciation Restructure...")

depreciation_restructure = {
    'Current_Account': [
        '7100', '7110', '7111', '7112', '7120', '7130', '7140', '7141', '7190'
    ],
    'Current_Name': [
        'Depreciation (Parent)', 'Depreciation - Tooling', 'MTN Tool Cert and NRE',
        'Depreciation for Asset #1702', 'Depreciation - Production Assets',
        'Depreciation - IT Hardware', 'Depreciation - Software', 
        'Depreciation on Asset #1701', 'Depreciation - Other'
    ],
    'New_Account': [
        '9600', '9610', '9611', '9612', '9620', '9630', '9640', '9641', '9690'
    ],
    'New_Name': [
        'Depreciation & Amortization (Parent)',
        'Depreciation - Tooling & Molds',
        'Depreciation - MTN Tool Cert NRE',
        'Depreciation - Specific Asset #1702',
        'Depreciation - Manufacturing Equipment',
        'Depreciation - IT Equipment',
        'Amortization - Software',
        'Amortization - Specific Asset #1701',
        'Depreciation - Other Assets'
    ],
    'Matches_Fixed_Asset': [
        'N/A (parent)', '1510', '1511', '1512', '1520', '1530', '1540', '1541', '1560'
    ],
    'GAAP_Location': [
        'Other Expenses (below Operating Income)',
        'Other Expenses', 'Other Expenses', 'Other Expenses',
        'Other Expenses', 'Other Expenses', 'Other Expenses',
        'Other Expenses', 'Other Expenses'
    ],
    'Priority': [
        '🟡 MEDIUM', '🟡 MEDIUM', '🟡 MEDIUM', '🟢 LOW',
        '🟡 MEDIUM', '🟡 MEDIUM', '🟡 MEDIUM', '🟢 LOW', '🟡 MEDIUM'
    ]
}

df_depreciation = pd.DataFrame(depreciation_restructure)
df_depreciation.to_excel(writer, sheet_name='7_Depreciation_Restructure', index=False)

# ============================================================================
# SHEET 8: PAYROLL LIABILITIES EXPANSION
# ============================================================================
print("📊 Creating Sheet 8: Payroll Liabilities Expansion...")

payroll_expansion = {
    'Recommended_Account': [
        '2310', '2320', '2321', '2322', '2323',
        '2324', '2325', '2326', '2327', '2328',
        '2329', '2330', '2340', '2350', '2360',
        '2370', '2380'
    ],
    'Account_Name': [
        'Salaries & Wages Payable',
        'Payroll Taxes Payable - Employer',
        'FUTA (Federal Unemployment)',
        'SUTA (State Unemployment)',
        'FICA/Medicare - Employer Portion',
        
        'Accrued PTO / Vacation',
        'Employee Tax Withholdings',
        'Federal Income Tax Withheld',
        'State Income Tax Withheld',
        'FICA/Medicare - Employee Portion',
        
        'Employee 401(k) Deferrals',
        'Employee Health Insurance Premiums',
        'Accrued Bonuses',
        '401(k) Employer Match Payable',
        'Health Insurance - Employer Portion',
        
        'Workers Compensation Insurance',
        'Garnishments Payable'
    ],
    'Liability_Type': [
        'Employer Liability', 'Employer Liability', 'Employer Liability',
        'Employer Liability', 'Employer Liability',
        
        'Employer Liability', 'Employee Withholding (trust)', 'Employee Withholding (trust)',
        'Employee Withholding (trust)', 'Employee Withholding (trust)',
        
        'Employee Withholding (trust)', 'Employee Withholding (trust)',
        'Employer Liability', 'Employer Liability', 'Employer Liability',
        
        'Employer Liability', 'Court-ordered (trust)'
    ],
    'Currently_Exists': [
        'Yes (2321)', 'Yes (2320)', 'No', 'No', 'No',
        'Yes (2324)', 'Partial (2325)', 'No', 'No', 'No',
        'No', 'No', 'Yes (2323)', 'No', 'No',
        'No', 'No'
    ],
    'GAAP_Required': [
        'Yes', 'Yes', 'Yes', 'Yes', 'Yes',
        'Yes', 'Yes', 'Yes', 'Yes', 'Yes',
        'Yes', 'Yes', 'Yes', 'Yes', 'Yes',
        'Yes', 'If applicable'
    ],
    'Priority': [
        '✅ EXISTS', '✅ EXISTS', '🟡 MEDIUM', '🟡 MEDIUM', '🟡 MEDIUM',
        '✅ EXISTS', '🟡 MEDIUM', '🟡 MEDIUM', '🟡 MEDIUM', '🟡 MEDIUM',
        '🟡 MEDIUM', '🟡 MEDIUM', '✅ EXISTS', '🟡 MEDIUM', '🟡 MEDIUM',
        '🟡 MEDIUM', '🟢 LOW'
    ]
}

df_payroll = pd.DataFrame(payroll_expansion)
df_payroll.to_excel(writer, sheet_name='8_Payroll_Expansion', index=False)

# ============================================================================
# SHEET 9: IMPLEMENTATION TIMELINE
# ============================================================================
print("📊 Creating Sheet 9: Implementation Timeline...")

timeline = {
    'Phase': [
        'Week 1', 'Week 1', 'Week 1', 'Week 1',
        'Week 2', 'Week 2', 'Week 2',
        'Week 3', 'Week 3', 'Week 3',
        'Month 2', 'Month 2', 'Month 2',
        'Month 3', 'Month 3'
    ],
    'Task': [
        'Create new R&D accounts (9000-9300)',
        'Create new DevOps accounts (6500-6540)',
        'Review & categorize 6190 contract labor transactions',
        'Document NRE vs DevOps policy',
        
        'Migrate 6110-6180 to 9000s',
        'Migrate DevOps costs from 1550s to 6500s',
        'Update BOSS portal NRE page (remove DevOps category)',
        
        'Create new depreciation accounts (9600s)',
        'Migrate 7100s to 9600s',
        'Test financial statements with new structure',
        
        'Expand payroll liabilities (2310-2380)',
        'Review capitalization policy with CFO/CPA',
        'Train team on new account structure',
        
        'Historical data cleanup (if needed)',
        'Finalize R&D tax credit documentation'
    ],
    'Owner': [
        'Accounting', 'Accounting', 'Accounting + Operations', 'CFO',
        'Accounting', 'Accounting', 'IT/Development',
        'Accounting', 'Accounting', 'Accounting + CFO',
        'Accounting', 'CFO', 'All',
        'Accounting', 'CFO + Tax Advisor'
    ],
    'Effort': [
        '2 hours', '1 hour', '4 hours', '2 hours',
        '4 hours', '3 hours', '2 hours',
        '1 hour', '2 hours', '3 hours',
        '2 hours', '4 hours', '2 hours',
        '8-16 hours', '4 hours'
    ],
    'Dependencies': [
        'None', 'None', 'None', 'None',
        'Week 1 complete', 'Week 1 complete', 'Week 1 complete',
        'Week 2 complete', 'Week 2 complete', 'Week 2 complete',
        'Week 3 complete', 'Week 3 complete', 'Week 3 complete',
        'Month 2 complete', 'All previous complete'
    ],
    'Success_Criteria': [
        'Accounts created in QB', 'Accounts created in QB',
        'All transactions categorized', 'Policy documented',
        'All historical transactions migrated', 'All DevOps costs reclassified',
        'BOSS portal updated', 'Accounts created', 'All depreciation migrated',
        'GAAP-compliant statements', 'All payroll detail accounts created',
        'Policy approved', 'Team trained', 'Clean historical data',
        'R&D tax credit maximized'
    ]
}

df_timeline = pd.DataFrame(timeline)
df_timeline.to_excel(writer, sheet_name='9_Implementation_Timeline', index=False)

# Save and close
writer.close()

print("\n" + "=" * 80)
print("✅ RESTRUCTURING PLAN CREATED")
print("=" * 80)
print(f"📁 File: {output_file}")
print()
print("📊 Contains 9 worksheets:")
print("  1. Executive Summary")
print("  2. NRE Capitalization Rules (GAAP)")
print("  3. NRE vs DevOps Distinction (with examples)")
print("  4. Account Migration Plan (6110-6190, 1550s, 7100s)")
print("  5. New R&D Account Structure (9000s)")
print("  6. New DevOps Account Structure (6500s)")
print("  7. Depreciation Restructure (7100s → 9600s)")
print("  8. Payroll Liabilities Expansion (2310-2380)")
print("  9. Implementation Timeline")
print()
print("=" * 80)

