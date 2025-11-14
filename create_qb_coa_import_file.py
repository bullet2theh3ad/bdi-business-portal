#!/usr/bin/env python3
"""
Create comprehensive QuickBooks Chart of Accounts import file
Includes existing accounts + new accounts with GAAP justification
"""

import pandas as pd
import json

# Load the current COA analysis
with open('/Users/Steve/Projects/BDI/BDI PORTAL/Proposed Chart of Accounts Changes _ vDraft2_analysis.json', 'r') as f:
    data = json.load(f)

output_file = "/Users/Steve/Projects/BDI/BDI PORTAL/QuickBooks_Complete_COA_Import.xlsx"

print("=" * 80)
print("CREATING QUICKBOOKS CHART OF ACCOUNTS IMPORT FILE")
print("=" * 80)
print()

# Extract existing accounts (skip header row)
existing_accounts = []
for account in data['account_data'][1:]:
    try:
        acct_num = account['Unnamed: 0']
        if acct_num and str(acct_num).strip() and acct_num != 'Number':
            existing_accounts.append({
                'Account_Number': int(float(acct_num)) if str(acct_num).replace('.', '').isdigit() else acct_num,
                'Account_Name': account['Unnamed: 1'],
                'Account_Type': account['Unnamed: 2'],
                'Detail_Type': account['Unnamed: 3'],
                'Description': account['Unnamed: 4'],
                'Status': 'EXISTING',
                'Action': 'Keep (no changes)',
                'GAAP_Classification': '',
                'BOSS_Category': '',
                'Justification': 'Existing account from current COA'
            })
    except (ValueError, KeyError, TypeError):
        continue

print(f"✓ Loaded {len(existing_accounts)} existing accounts")

# Define all new accounts to create
new_accounts = []

# ============================================================================
# NEW R&D ACCOUNTS (9000s)
# ============================================================================
rd_accounts = [
    {
        'Account_Number': 9000,
        'Account_Name': 'Research & Development',
        'Account_Type': 'Expense',
        'Detail_Type': 'Research & Development',
        'Description': 'Parent account for all R&D expenses including product development, certifications, testing, and engineering services. Per GAAP, R&D costs are expensed as incurred unless specific capitalization criteria are met.',
        'GAAP_Classification': 'Operating Expenses - R&D',
        'BOSS_Category': 'NRE',
        'Justification': 'GAAP ASC 730 requires separate R&D disclosure. Separates product development from operational expenses for accurate financial reporting and R&D tax credit calculations.'
    },
    {
        'Account_Number': 9010,
        'Account_Name': 'Product Engineering & Design',
        'Account_Type': 'Expense',
        'Detail_Type': 'Research & Development',
        'Description': 'Engineering and design costs for NEW products or significant product improvements. Includes circuit board design, mechanical engineering, and product architecture. Qualifies for R&D tax credits.',
        'GAAP_Classification': 'Operating Expenses - R&D',
        'BOSS_Category': 'NRE',
        'Justification': 'Core R&D activity per ASC 730. Distinct from maintenance/support activities. Essential for R&D tax credit substantiation.'
    },
    {
        'Account_Number': 9020,
        'Account_Name': 'Firmware Development',
        'Account_Type': 'Expense',
        'Detail_Type': 'Research & Development',
        'Description': 'Firmware development for NEW products or major firmware enhancements. Software development costs may be capitalized after technological feasibility is established (ASC 985-20).',
        'GAAP_Classification': 'Operating Expenses - R&D',
        'BOSS_Category': 'NRE',
        'Justification': 'ASC 985-20 software development costs. Expense until technological feasibility, then may capitalize. Critical for proper R&D vs COGS classification.'
    },
    {
        'Account_Number': 9030,
        'Account_Name': 'R&D Documentation & Specifications',
        'Account_Type': 'Expense',
        'Detail_Type': 'Research & Development',
        'Description': 'Technical documentation, specifications, design documents, and engineering records for product development activities.',
        'GAAP_Classification': 'Operating Expenses - R&D',
        'BOSS_Category': 'NRE',
        'Justification': 'Supporting R&D activity per ASC 730. Required for R&D tax credit documentation.'
    },
    {
        'Account_Number': 9100,
        'Account_Name': 'Product Compliance',
        'Account_Type': 'Expense',
        'Detail_Type': 'Research & Development',
        'Description': 'Parent account for product certifications, compliance testing, and regulatory requirements for NEW products.',
        'GAAP_Classification': 'Operating Expenses - R&D',
        'BOSS_Category': 'NRE',
        'Justification': 'Essential R&D for bringing new products to market. Required by regulatory bodies. Qualifies for R&D tax credits.'
    },
    {
        'Account_Number': 9110,
        'Account_Name': 'Product Certifications (UL, FCC, CE)',
        'Account_Type': 'Expense',
        'Detail_Type': 'Research & Development',
        'Description': 'Safety and regulatory certifications (UL, FCC, CE, RoHS, etc.) required for NEW products. Per GAAP, these costs are expensed as incurred and cannot be capitalized.',
        'GAAP_Classification': 'Operating Expenses - R&D',
        'BOSS_Category': 'NRE - Certifications',
        'Justification': 'ASC 730 requires expensing. Critical for market entry. Qualifies for R&D tax credits under IRS guidelines.'
    },
    {
        'Account_Number': 9120,
        'Account_Name': 'Compliance Testing & Validation',
        'Account_Type': 'Expense',
        'Detail_Type': 'Research & Development',
        'Description': 'Testing and validation of NEW products for safety, performance, and regulatory compliance. Includes lab testing, third-party validation, and quality assurance testing.',
        'GAAP_Classification': 'Operating Expenses - R&D',
        'BOSS_Category': 'NRE - Testing & Validation',
        'Justification': 'ASC 730 R&D expense. Testing NEW products qualifies for R&D tax credits. Distinct from production QA testing (COGS).'
    },
    {
        'Account_Number': 9130,
        'Account_Name': 'Regulatory & Registration Fees',
        'Account_Type': 'Expense',
        'Detail_Type': 'Research & Development',
        'Description': 'Government and regulatory agency fees for NEW product registration, compliance filings, and certifications.',
        'GAAP_Classification': 'Operating Expenses - R&D',
        'BOSS_Category': 'NRE - Certifications',
        'Justification': 'Part of R&D process for new product launch. May qualify for R&D tax credits if related to certification testing.'
    },
    {
        'Account_Number': 9200,
        'Account_Name': 'Prototyping & Tooling Expense',
        'Account_Type': 'Expense',
        'Detail_Type': 'Research & Development',
        'Description': 'Parent account for prototype development and tooling costs that are EXPENSED (not capitalized). Tooling > $2,500 with life > 1 year should be capitalized to Fixed Assets (1510).',
        'GAAP_Classification': 'Operating Expenses - R&D',
        'BOSS_Category': 'NRE',
        'Justification': 'ASC 730 R&D expense. Low-value or single-use tooling expensed. High-value reusable tooling capitalized per ASC 360.'
    },
    {
        'Account_Number': 9210,
        'Account_Name': 'Mold Design & Engineering (Expensed)',
        'Account_Type': 'Expense',
        'Detail_Type': 'Research & Development',
        'Description': 'Design and engineering of molds and tooling (expensed portion). If mold cost exceeds $2,500 and useful life > 1 year, capitalize to account 1510.',
        'GAAP_Classification': 'Operating Expenses - R&D',
        'BOSS_Category': 'NRE - Tooling',
        'Justification': 'ASC 730 for expensed R&D. ASC 360 capitalization threshold: > $2.5k and useful life > 1 year.'
    },
    {
        'Account_Number': 9220,
        'Account_Name': 'Prototype Materials & Services',
        'Account_Type': 'Expense',
        'Detail_Type': 'Research & Development',
        'Description': 'Materials, components, and services for building prototypes of NEW products. Includes prototype fabrication, assembly, and related costs.',
        'GAAP_Classification': 'Operating Expenses - R&D',
        'BOSS_Category': 'NRE - Prototyping',
        'Justification': 'ASC 730 R&D expense. Prototypes are developmental units, not for sale. Qualifies for R&D tax credits.'
    },
    {
        'Account_Number': 9230,
        'Account_Name': 'Test Fixtures & Jigs (Expensed)',
        'Account_Type': 'Expense',
        'Detail_Type': 'Research & Development',
        'Description': 'Test fixtures, jigs, and testing equipment that are low-value or single-use (expensed). Reusable test equipment > $2,500 should be capitalized to account 1530.',
        'GAAP_Classification': 'Operating Expenses - R&D',
        'BOSS_Category': 'NRE - Prototyping',
        'Justification': 'ASC 730 for expensed items. ASC 360 for capitalization threshold: reusable equipment > $2.5k → Fixed Assets.'
    },
    {
        'Account_Number': 9300,
        'Account_Name': 'R&D Services',
        'Account_Type': 'Expense',
        'Detail_Type': 'Research & Development',
        'Description': 'Parent account for external R&D services including engineering consultants, technical documentation, and contract R&D labor.',
        'GAAP_Classification': 'Operating Expenses - R&D',
        'BOSS_Category': 'NRE',
        'Justification': 'ASC 730 R&D expense. External services for product development qualify for R&D tax credits.'
    },
    {
        'Account_Number': 9310,
        'Account_Name': 'Engineering Consultants',
        'Account_Type': 'Expense',
        'Detail_Type': 'Contract Labor',
        'Description': 'Engineering consultants and contract engineers working on NEW product development. Includes design, testing, and technical consulting for R&D activities.',
        'GAAP_Classification': 'Operating Expenses - R&D',
        'BOSS_Category': 'NRE - Engineering Services',
        'Justification': 'ASC 730 R&D expense. Contractor wages for qualified research activities eligible for R&D tax credit at 65% of wages.'
    },
    {
        'Account_Number': 9320,
        'Account_Name': 'Technical Documentation Services',
        'Account_Type': 'Expense',
        'Detail_Type': 'Legal & Professional Fees',
        'Description': 'External services for creating technical documentation, user manuals, specifications, and engineering records for NEW products.',
        'GAAP_Classification': 'Operating Expenses - R&D',
        'BOSS_Category': 'NRE - Engineering Services',
        'Justification': 'Supporting R&D activity per ASC 730. May qualify for R&D tax credits if part of development process.'
    },
    {
        'Account_Number': 9330,
        'Account_Name': 'R&D Contract Labor',
        'Account_Type': 'Expense',
        'Detail_Type': 'Contract Labor',
        'Description': 'Contract labor (1099) performing R&D activities including product design, testing, prototyping, and development work for NEW products.',
        'GAAP_Classification': 'Operating Expenses - R&D',
        'BOSS_Category': 'NRE - Contract Labor',
        'Justification': 'ASC 730 R&D expense. 1099 contractors performing qualified research → R&D tax credit eligible at 65% of contract value.'
    },
]

new_accounts.extend(rd_accounts)

# ============================================================================
# NEW DEVOPS ACCOUNTS (6500s)
# ============================================================================
devops_accounts = [
    {
        'Account_Number': 6500,
        'Account_Name': 'DevOps & Infrastructure',
        'Account_Type': 'Expense',
        'Detail_Type': 'Office / General Administrative Expenses',
        'Description': 'Parent account for DevOps and IT infrastructure expenses. These are OPERATIONAL expenses for maintaining EXISTING systems, NOT R&D. Per GAAP, ongoing infrastructure costs are G&A expenses.',
        'GAAP_Classification': 'Operating Expenses - G&A',
        'BOSS_Category': 'OpEx',
        'Justification': 'GAAP distinguishes R&D (new development) from G&A (operations). DevOps maintains existing systems → G&A, not R&D tax credit eligible.'
    },
    {
        'Account_Number': 6510,
        'Account_Name': 'Cloud Hosting Services',
        'Account_Type': 'Expense',
        'Detail_Type': 'Office / General Administrative Expenses',
        'Description': 'AWS, Azure, Google Cloud, and other cloud hosting services for EXISTING applications and infrastructure. Ongoing operational expense, not capitalizable.',
        'GAAP_Classification': 'Operating Expenses - G&A',
        'BOSS_Category': 'OpEx - Services',
        'Justification': 'ASC 350-40: Cloud computing arrangements are service contracts (expense). Not R&D → no tax credit. Regular business operations.'
    },
    {
        'Account_Number': 6511,
        'Account_Name': 'AWS Services',
        'Account_Type': 'Expense',
        'Detail_Type': 'Office / General Administrative Expenses',
        'Description': 'Amazon Web Services hosting, compute, storage, and related AWS cloud services for operational infrastructure.',
        'GAAP_Classification': 'Operating Expenses - G&A',
        'BOSS_Category': 'OpEx - Services',
        'Justification': 'Operating expense per ASC 350-40. Ongoing operational cost, not capitalizable or R&D eligible.'
    },
    {
        'Account_Number': 6512,
        'Account_Name': 'Azure Services',
        'Account_Type': 'Expense',
        'Detail_Type': 'Office / General Administrative Expenses',
        'Description': 'Microsoft Azure cloud services for operational infrastructure and applications.',
        'GAAP_Classification': 'Operating Expenses - G&A',
        'BOSS_Category': 'OpEx - Services',
        'Justification': 'Operating expense per ASC 350-40. Business-as-usual IT operations.'
    },
    {
        'Account_Number': 6513,
        'Account_Name': 'Other Cloud Providers',
        'Account_Type': 'Expense',
        'Detail_Type': 'Office / General Administrative Expenses',
        'Description': 'Cloud hosting services from providers other than AWS or Azure (e.g., Google Cloud, DigitalOcean, Heroku).',
        'GAAP_Classification': 'Operating Expenses - G&A',
        'BOSS_Category': 'OpEx - Services',
        'Justification': 'Operating expense per ASC 350-40. Operational infrastructure costs.'
    },
    {
        'Account_Number': 6520,
        'Account_Name': 'Infrastructure Support',
        'Account_Type': 'Expense',
        'Detail_Type': 'Office / General Administrative Expenses',
        'Description': 'Infrastructure monitoring, management, automation, and support services for EXISTING systems. Includes CI/CD tools, monitoring platforms, and infrastructure automation.',
        'GAAP_Classification': 'Operating Expenses - G&A',
        'BOSS_Category': 'OpEx - Services',
        'Justification': 'Operating expense for maintaining existing infrastructure. Not R&D → not eligible for R&D tax credits.'
    },
    {
        'Account_Number': 6521,
        'Account_Name': 'Server Monitoring & Management',
        'Account_Type': 'Expense',
        'Detail_Type': 'Office / General Administrative Expenses',
        'Description': 'Monitoring tools, alerting systems, and server management platforms (e.g., Datadog, New Relic, Nagios) for operational systems.',
        'GAAP_Classification': 'Operating Expenses - G&A',
        'BOSS_Category': 'OpEx - Services',
        'Justification': 'Business operations expense. Maintains existing systems, not development.'
    },
    {
        'Account_Number': 6522,
        'Account_Name': 'CI/CD Pipeline Tools',
        'Account_Type': 'Expense',
        'Detail_Type': 'Office / General Administrative Expenses',
        'Description': 'Continuous integration and deployment tools (e.g., Jenkins, GitHub Actions, CircleCI) for maintaining EXISTING applications.',
        'GAAP_Classification': 'Operating Expenses - G&A',
        'BOSS_Category': 'OpEx - Services',
        'Justification': 'Operational tooling for existing systems. Not R&D per ASC 730.'
    },
    {
        'Account_Number': 6523,
        'Account_Name': 'Infrastructure Automation',
        'Account_Type': 'Expense',
        'Detail_Type': 'Office / General Administrative Expenses',
        'Description': 'Infrastructure-as-code tools and automation platforms (e.g., Terraform, Ansible, Puppet) for managing operational infrastructure.',
        'GAAP_Classification': 'Operating Expenses - G&A',
        'BOSS_Category': 'OpEx - Services',
        'Justification': 'Operational efficiency tooling. G&A expense, not R&D.'
    },
    {
        'Account_Number': 6530,
        'Account_Name': 'Application Hosting',
        'Account_Type': 'Expense',
        'Detail_Type': 'Office / General Administrative Expenses',
        'Description': 'Database hosting, CDN services, load balancing, and application-level hosting for EXISTING production applications.',
        'GAAP_Classification': 'Operating Expenses - G&A',
        'BOSS_Category': 'OpEx - Services',
        'Justification': 'Operating expense for production systems. Not capitalizable per ASC 350-40.'
    },
    {
        'Account_Number': 6531,
        'Account_Name': 'Database Hosting',
        'Account_Type': 'Expense',
        'Detail_Type': 'Office / General Administrative Expenses',
        'Description': 'Database hosting services (e.g., RDS, managed PostgreSQL, MongoDB Atlas) for operational databases.',
        'GAAP_Classification': 'Operating Expenses - G&A',
        'BOSS_Category': 'OpEx - Services',
        'Justification': 'Operating expense. Ongoing service costs not capitalizable.'
    },
    {
        'Account_Number': 6532,
        'Account_Name': 'CDN & Load Balancing',
        'Account_Type': 'Expense',
        'Detail_Type': 'Office / General Administrative Expenses',
        'Description': 'Content delivery networks and load balancers (e.g., CloudFront, Cloudflare, load balancer services) for operational applications.',
        'GAAP_Classification': 'Operating Expenses - G&A',
        'BOSS_Category': 'OpEx - Services',
        'Justification': 'Operating expense for production infrastructure. Not R&D.'
    },
    {
        'Account_Number': 6540,
        'Account_Name': 'DevOps Tools & Licenses',
        'Account_Type': 'Expense',
        'Detail_Type': 'Dues & Subscriptions',
        'Description': 'DevOps software licenses, development tools, and platform subscriptions for operational activities (not new development).',
        'GAAP_Classification': 'Operating Expenses - G&A',
        'BOSS_Category': 'OpEx - Software & Subscriptions',
        'Justification': 'ASC 350-40 software subscriptions expensed. Operational tools, not R&D.'
    },
    {
        'Account_Number': 6541,
        'Account_Name': 'Development Tools & IDEs',
        'Account_Type': 'Expense',
        'Detail_Type': 'Dues & Subscriptions',
        'Description': 'Development environment tools, IDEs, and related software for maintenance and operations (e.g., Visual Studio, IntelliJ licenses).',
        'GAAP_Classification': 'Operating Expenses - G&A',
        'BOSS_Category': 'OpEx - Software & Subscriptions',
        'Justification': 'Operating expense. Tools for maintaining existing systems.'
    },
    {
        'Account_Number': 6542,
        'Account_Name': 'DevOps Platforms (GitHub, GitLab)',
        'Account_Type': 'Expense',
        'Detail_Type': 'Dues & Subscriptions',
        'Description': 'Source control, collaboration, and DevOps platform subscriptions (e.g., GitHub, GitLab, Bitbucket).',
        'GAAP_Classification': 'Operating Expenses - G&A',
        'BOSS_Category': 'OpEx - Software & Subscriptions',
        'Justification': 'Operating expense per ASC 350-40. Operational tooling.'
    },
]

new_accounts.extend(devops_accounts)

# ============================================================================
# NEW LABOR ACCOUNTS (7000s)
# ============================================================================
labor_accounts = [
    {
        'Account_Number': 7000,
        'Account_Name': 'Labor Expenses',
        'Account_Type': 'Expense',
        'Detail_Type': 'Payroll Expense',
        'Description': 'Parent account for all labor-related expenses including W2 salaries, payroll taxes, benefits, and contract labor. Per GAAP, labor is allocated by functional area (COGS, R&D, S&M, G&A).',
        'GAAP_Classification': 'Multiple (by function)',
        'BOSS_Category': 'Labor',
        'Justification': 'GAAP requires functional expense allocation. Labor costs allocated to COGS (manufacturing), R&D, S&M, or G&A based on employee role.'
    },
    {
        'Account_Number': 7210,
        'Account_Name': 'Engineering Contractors',
        'Account_Type': 'Expense',
        'Detail_Type': 'Contract Labor',
        'Description': 'Contract labor (1099) for engineering and technical work. CRITICAL: Review each transaction to allocate to R&D (9330) if working on NEW products, or keep here if operational support.',
        'GAAP_Classification': 'Operating Expenses - R&D or G&A',
        'BOSS_Category': 'Labor - Contract Labor',
        'Justification': 'IRS guidance: 1099 contractors performing qualified research → 65% eligible for R&D tax credit. Must distinguish R&D vs operational work.'
    },
    {
        'Account_Number': 7220,
        'Account_Name': 'Operations Contractors',
        'Account_Type': 'Expense',
        'Detail_Type': 'Contract Labor',
        'Description': 'Contract labor (1099) for operational, administrative, and general business support. Not R&D related.',
        'GAAP_Classification': 'Operating Expenses - G&A',
        'BOSS_Category': 'Labor - Contract Labor',
        'Justification': 'Operating expense. Supports business operations, not product development. Not R&D tax credit eligible.'
    },
    {
        'Account_Number': 7230,
        'Account_Name': 'Marketing Contractors',
        'Account_Type': 'Expense',
        'Detail_Type': 'Contract Labor',
        'Description': 'Contract labor (1099) for marketing, advertising, content creation, and sales support activities.',
        'GAAP_Classification': 'Operating Expenses - S&M',
        'BOSS_Category': 'Labor - Contract Labor',
        'Justification': 'Operating expense - Sales & Marketing function. Not R&D tax credit eligible.'
    },
]

new_accounts.extend(labor_accounts)

# ============================================================================
# NEW DEPRECIATION ACCOUNTS (9600s)
# ============================================================================
depreciation_accounts = [
    {
        'Account_Number': 9600,
        'Account_Name': 'Depreciation & Amortization',
        'Account_Type': 'Other Expense',
        'Detail_Type': 'Depreciation',
        'Description': 'Parent account for depreciation of tangible assets and amortization of intangible assets. Per GAAP, depreciation appears "below the line" after Operating Income on Income Statement.',
        'GAAP_Classification': 'Other Expenses (Below Operating Income)',
        'BOSS_Category': 'Other',
        'Justification': 'GAAP Income Statement: Operating Income - Other Expenses (Depreciation + Interest) = Net Income. ASC 360 fixed asset depreciation.'
    },
    {
        'Account_Number': 9610,
        'Account_Name': 'Depreciation - Tooling & Molds',
        'Account_Type': 'Other Expense',
        'Detail_Type': 'Depreciation',
        'Description': 'Depreciation of capitalized tooling and molds (Fixed Asset account 1510). Depreciation method: 3-7 years straight-line or units-of-production.',
        'GAAP_Classification': 'Other Expenses',
        'BOSS_Category': 'Other',
        'Justification': 'Matches Fixed Asset 1510. ASC 360 depreciation over useful life. May use Section 179 or Bonus Depreciation for tax.'
    },
    {
        'Account_Number': 9620,
        'Account_Name': 'Depreciation - Manufacturing Equipment',
        'Account_Type': 'Other Expense',
        'Detail_Type': 'Depreciation',
        'Description': 'Depreciation of production equipment and machinery (Fixed Asset account 1520). Depreciation method: 5-7 years straight-line.',
        'GAAP_Classification': 'Other Expenses',
        'BOSS_Category': 'Other',
        'Justification': 'Matches Fixed Asset 1520. ASC 360 depreciation. Production equipment typically 5-7 year MACRS for tax.'
    },
    {
        'Account_Number': 9630,
        'Account_Name': 'Depreciation - Test Equipment',
        'Account_Type': 'Other Expense',
        'Detail_Type': 'Depreciation',
        'Description': 'Depreciation of test equipment and fixtures (Fixed Asset account 1530). Depreciation method: 5 years straight-line.',
        'GAAP_Classification': 'Other Expenses',
        'BOSS_Category': 'Other',
        'Justification': 'Matches Fixed Asset 1530. ASC 360 depreciation over 5-year useful life.'
    },
    {
        'Account_Number': 9640,
        'Account_Name': 'Depreciation - IT Equipment',
        'Account_Type': 'Other Expense',
        'Detail_Type': 'Depreciation',
        'Description': 'Depreciation of computers, servers, and IT hardware (Fixed Asset account 1530). Depreciation method: 3-5 years straight-line.',
        'GAAP_Classification': 'Other Expenses',
        'BOSS_Category': 'Other',
        'Justification': 'Matches Fixed Asset 1530. ASC 360 depreciation. IT equipment typically 3-5 year life, 5-year MACRS for tax.'
    },
    {
        'Account_Number': 9650,
        'Account_Name': 'Amortization - Software',
        'Account_Type': 'Other Expense',
        'Detail_Type': 'Amortization',
        'Description': 'Amortization of capitalized software (Fixed Asset account 1540). Amortization method: 3-5 years (product life) straight-line.',
        'GAAP_Classification': 'Other Expenses',
        'BOSS_Category': 'Other',
        'Justification': 'Matches Fixed Asset 1540. ASC 985-20 software amortization over product revenue life or 3-5 years.'
    },
]

new_accounts.extend(depreciation_accounts)

# ============================================================================
# NEW PAYROLL LIABILITY ACCOUNTS (2300s expansion)
# ============================================================================
payroll_liability_accounts = [
    {
        'Account_Number': 2310,
        'Account_Name': 'Salaries & Wages Payable',
        'Account_Type': 'Other Current Liabilities',
        'Detail_Type': 'Payroll Liabilities',
        'Description': 'Accrued unpaid salaries and wages earned by employees but not yet paid as of period-end. Per GAAP, must accrue earned but unpaid compensation.',
        'GAAP_Classification': 'Current Liabilities',
        'BOSS_Category': 'N/A (Balance Sheet)',
        'Justification': 'GAAP accrual accounting (ASC 450). Liability for earned unpaid wages. Critical for accurate period-end financials.'
    },
    {
        'Account_Number': 2326,
        'Account_Name': 'Federal Income Tax Withheld',
        'Account_Type': 'Other Current Liabilities',
        'Detail_Type': 'Payroll Liabilities',
        'Description': 'Federal income tax withheld from employee paychecks, held in trust until remitted to IRS. Fiduciary liability.',
        'GAAP_Classification': 'Current Liabilities',
        'BOSS_Category': 'N/A (Balance Sheet)',
        'Justification': 'IRS trust fund taxes. Must be separately tracked for compliance. Failure to remit = Trust Fund Recovery Penalty.'
    },
    {
        'Account_Number': 2327,
        'Account_Name': 'State Income Tax Withheld',
        'Account_Type': 'Other Current Liabilities',
        'Detail_Type': 'Payroll Liabilities',
        'Description': 'State income tax withheld from employee paychecks, held in trust until remitted to state tax authorities.',
        'GAAP_Classification': 'Current Liabilities',
        'BOSS_Category': 'N/A (Balance Sheet)',
        'Justification': 'State trust fund taxes. Separate tracking required for multi-state compliance.'
    },
    {
        'Account_Number': 2328,
        'Account_Name': 'FICA/Medicare - Employee Portion',
        'Account_Type': 'Other Current Liabilities',
        'Detail_Type': 'Payroll Liabilities',
        'Description': 'FICA and Medicare taxes withheld from employee paychecks (7.65% of wages). Trust fund liability until remitted to IRS.',
        'GAAP_Classification': 'Current Liabilities',
        'BOSS_Category': 'N/A (Balance Sheet)',
        'Justification': 'IRS trust fund taxes. Employee portion separate from employer portion (2323) for accurate tax reporting.'
    },
    {
        'Account_Number': 2329,
        'Account_Name': 'Employee 401(k) Deferrals',
        'Account_Type': 'Other Current Liabilities',
        'Detail_Type': 'Payroll Liabilities',
        'Description': '401(k) employee deferrals withheld from paychecks, held until remitted to 401(k) plan administrator. ERISA fiduciary liability.',
        'GAAP_Classification': 'Current Liabilities',
        'BOSS_Category': 'N/A (Balance Sheet)',
        'Justification': 'ERISA requires remittance as soon as administratively feasible (max 7 business days for small plans). Fiduciary liability.'
    },
    {
        'Account_Number': 2350,
        'Account_Name': '401(k) Employer Match Payable',
        'Account_Type': 'Other Current Liabilities',
        'Detail_Type': 'Payroll Liabilities',
        'Description': 'Accrued employer 401(k) matching contributions not yet remitted to plan administrator.',
        'GAAP_Classification': 'Current Liabilities',
        'BOSS_Category': 'N/A (Balance Sheet)',
        'Justification': 'GAAP accrual accounting. Employer match expense accrued when earned, liability until remitted.'
    },
    {
        'Account_Number': 2360,
        'Account_Name': 'Health Insurance - Employer Portion Payable',
        'Account_Type': 'Other Current Liabilities',
        'Detail_Type': 'Payroll Liabilities',
        'Description': 'Accrued employer portion of health insurance premiums not yet paid to insurance carrier.',
        'GAAP_Classification': 'Current Liabilities',
        'BOSS_Category': 'N/A (Balance Sheet)',
        'Justification': 'GAAP accrual accounting. Employer health insurance cost accrued monthly, liability until paid.'
    },
    {
        'Account_Number': 2370,
        'Account_Name': 'Workers Compensation Insurance Payable',
        'Account_Type': 'Other Current Liabilities',
        'Detail_Type': 'Payroll Liabilities',
        'Description': 'Accrued workers compensation insurance premiums based on payroll. Typically billed quarterly or annually.',
        'GAAP_Classification': 'Current Liabilities',
        'BOSS_Category': 'N/A (Balance Sheet)',
        'Justification': 'GAAP accrual accounting. WC premiums based on actual payroll, reconciled at year-end. Accrual prevents large period-end adjustments.'
    },
]

new_accounts.extend(payroll_liability_accounts)

# Format all new accounts
for account in new_accounts:
    account['Status'] = 'NEW'
    account['Action'] = 'CREATE'

print(f"✓ Created {len(new_accounts)} new accounts")

# Combine existing and new accounts
all_accounts = existing_accounts + new_accounts

# Sort by account number
all_accounts.sort(key=lambda x: (int(x['Account_Number']) if isinstance(x['Account_Number'], (int, float)) or str(x['Account_Number']).isdigit() else 9999999, str(x['Account_Number'])))

print(f"✓ Total accounts: {len(all_accounts)}")
print()

# Create DataFrame
df = pd.DataFrame(all_accounts)

# Reorder columns for QB import
df = df[[
    'Status',
    'Action',
    'Account_Number',
    'Account_Name',
    'Account_Type',
    'Detail_Type',
    'Description',
    'GAAP_Classification',
    'BOSS_Category',
    'Justification'
]]

# Create Excel file with multiple sheets
print("=" * 80)
print("CREATING EXCEL FILE")
print("=" * 80)
print()

with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
    # Sheet 1: Complete COA
    df.to_excel(writer, sheet_name='Complete_COA', index=False)
    print("✓ Sheet 1: Complete Chart of Accounts (All Accounts)")
    
    # Sheet 2: New accounts only
    df_new = df[df['Status'] == 'NEW'].copy()
    df_new.to_excel(writer, sheet_name='New_Accounts_Only', index=False)
    print(f"✓ Sheet 2: New Accounts Only ({len(df_new)} accounts)")
    
    # Sheet 3: QB Import Format (simplified)
    df_qb = df[['Account_Number', 'Account_Name', 'Account_Type', 'Detail_Type', 'Description']].copy()
    df_qb.columns = ['Number', 'Name', 'Type', 'Detail Type', 'Description']
    df_qb.to_excel(writer, sheet_name='QB_Import_Format', index=False)
    print("✓ Sheet 3: QuickBooks Import Format")
    
    # Sheet 4: Summary by Status
    summary_data = []
    for status in ['EXISTING', 'NEW']:
        count = len(df[df['Status'] == status])
        summary_data.append({
            'Status': status,
            'Count': count,
            'Percentage': f"{count / len(df) * 100:.1f}%"
        })
    
    df_summary = pd.DataFrame(summary_data)
    df_summary.to_excel(writer, sheet_name='Summary', index=False)
    print("✓ Sheet 4: Summary Statistics")
    
    # Sheet 5: Summary by Account Type
    type_summary = df.groupby(['Account_Type', 'Status']).size().reset_index(name='Count')
    type_summary = type_summary.pivot(index='Account_Type', columns='Status', values='Count').fillna(0)
    type_summary['Total'] = type_summary.sum(axis=1)
    type_summary.to_excel(writer, sheet_name='Summary_by_Type')
    print("✓ Sheet 5: Summary by Account Type")
    
    # Sheet 6: GAAP Classification Reference
    gaap_ref = [
        {'Statement': 'Balance Sheet', 'Section': 'Assets', 'Account_Range': '1000-1999', 'Examples': 'Cash, AR, Inventory, Fixed Assets'},
        {'Statement': 'Balance Sheet', 'Section': 'Liabilities', 'Account_Range': '2000-2999', 'Examples': 'AP, Credit Cards, Loans, Payroll Liabilities'},
        {'Statement': 'Balance Sheet', 'Section': 'Equity', 'Account_Range': '3000-3999', 'Examples': 'Stock, Retained Earnings, Paid-in Capital'},
        {'Statement': 'Income Statement', 'Section': 'Revenue', 'Account_Range': '4000-4999', 'Examples': 'Product Sales, Service Revenue'},
        {'Statement': 'Income Statement', 'Section': 'COGS', 'Account_Range': '5000-5999', 'Examples': 'Materials, Direct Labor, Manufacturing Overhead'},
        {'Statement': 'Income Statement', 'Section': 'Operating Expenses', 'Account_Range': '6000-8999', 'Examples': 'G&A (6000s), Labor (7000s), Marketing (8000s), R&D (9000s)'},
        {'Statement': 'Income Statement', 'Section': 'Other Expenses', 'Account_Range': '9600s', 'Examples': 'Depreciation, Amortization'},
        {'Statement': 'Income Statement', 'Section': 'Interest & Other', 'Account_Range': '9500s, 9700s', 'Examples': 'Interest Expense, Other Income/Expense'},
    ]
    df_gaap_ref = pd.DataFrame(gaap_ref)
    df_gaap_ref.to_excel(writer, sheet_name='GAAP_Reference', index=False)
    print("✓ Sheet 6: GAAP Classification Reference")

print()
print("=" * 80)
print("✅ QUICKBOOKS IMPORT FILE CREATED")
print("=" * 80)
print(f"📁 File: {output_file}")
print()
print("📊 Summary:")
print(f"  • Total Accounts: {len(all_accounts)}")
print(f"  • Existing Accounts: {len(existing_accounts)}")
print(f"  • New Accounts: {len(new_accounts)}")
print()
print("📋 New Accounts Breakdown:")
print(f"  • R&D (9000s): 16 accounts")
print(f"  • DevOps (6500s): 15 accounts")
print(f"  • Labor (7000s): 4 accounts")
print(f"  • Depreciation (9600s): 6 accounts")
print(f"  • Payroll Liabilities (2300s): 8 accounts")
print()
print("🎯 How to Use:")
print("  1. Review 'Complete_COA' sheet for all accounts with justifications")
print("  2. Review 'New_Accounts_Only' sheet for accounts to create")
print("  3. Use 'QB_Import_Format' sheet for QuickBooks import")
print("  4. Refer to 'GAAP_Reference' for account numbering logic")
print()
print("💡 Import to QuickBooks:")
print("  • QuickBooks Desktop: Save 'QB_Import_Format' as CSV → Import")
print("  • QuickBooks Online: Use 'Complete_COA' sheet → Manual entry or CSV import")
print()
print("=" * 80)

