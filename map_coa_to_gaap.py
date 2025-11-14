#!/usr/bin/env python3
"""
Map Chart of Accounts to GAAP Financial Statement Line Items
"""

import pandas as pd
from datetime import datetime

# Input and output files
input_file = "/Users/Steve/Projects/BDI/BDI PORTAL/Proposed Chart of Accounts Changes _ vDraft2.xlsx"
output_file = "/Users/Steve/Projects/BDI/BDI PORTAL/COA_with_GAAP_Mapping.xlsx"

print("=" * 80)
print("GAAP FINANCIAL STATEMENT MAPPING")
print("=" * 80)
print()

# Read the Excel file
df = pd.read_excel(input_file, sheet_name=0)
print(f"✓ Loaded {len(df)} accounts from Excel file")
print()

# Get column names
print("Original columns:", list(df.columns))
print()

# The first row is headers, so let's use that
# Assuming structure: Number, Name, Account Type, Detail Type, Description, ...
col_number = df.columns[0]
col_name = df.columns[1]
col_account_type = df.columns[2]
col_detail_type = df.columns[3]
col_description = df.columns[4]

# Skip the header row if it exists
if df.iloc[0][col_number] == 'Number' or str(df.iloc[0][col_number]).lower() == 'number':
    df = df.iloc[1:].reset_index(drop=True)
    print("✓ Removed header row")

# GAAP Mapping Rules
def map_to_gaap_financial_statement(account_type):
    """Map account type to primary financial statement"""
    account_type_lower = str(account_type).lower()
    
    # Balance Sheet accounts
    if any(x in account_type_lower for x in ['asset', 'bank', 'accounts receivable', 'inventory']):
        return 'Balance Sheet'
    elif any(x in account_type_lower for x in ['liability', 'liabilities', 'accounts payable']):
        return 'Balance Sheet'
    elif 'equity' in account_type_lower:
        return 'Balance Sheet'
    
    # Income Statement accounts
    elif 'income' in account_type_lower or 'revenue' in account_type_lower:
        return 'Income Statement'
    elif 'cost of goods sold' in account_type_lower or 'cogs' in account_type_lower:
        return 'Income Statement'
    elif 'expense' in account_type_lower:
        return 'Income Statement'
    
    else:
        return 'Unknown'

def map_to_gaap_category(account_type):
    """Map account type to GAAP category"""
    account_type_lower = str(account_type).lower()
    
    # Assets
    if 'bank' in account_type_lower:
        return 'Current Assets - Cash'
    elif 'accounts receivable' in account_type_lower or 'a/r' in account_type_lower:
        return 'Current Assets - Accounts Receivable'
    elif 'inventory' in account_type_lower:
        return 'Current Assets - Inventory'
    elif 'current asset' in account_type_lower:
        return 'Current Assets - Other'
    elif 'fixed asset' in account_type_lower:
        return 'Fixed Assets'
    elif 'other asset' in account_type_lower:
        return 'Other Assets'
    
    # Liabilities
    elif 'accounts payable' in account_type_lower or 'a/p' in account_type_lower:
        return 'Current Liabilities - Accounts Payable'
    elif 'current liab' in account_type_lower:
        return 'Current Liabilities - Other'
    elif 'long term liab' in account_type_lower or 'long-term liab' in account_type_lower:
        return 'Long-Term Liabilities'
    
    # Equity
    elif 'equity' in account_type_lower:
        return 'Equity'
    
    # Revenue
    elif 'income' in account_type_lower or 'revenue' in account_type_lower:
        if 'other' in account_type_lower or 'operating income' in account_type_lower:
            return 'Other Income'
        else:
            return 'Revenue'
    
    # COGS
    elif 'cost of goods sold' in account_type_lower or 'cogs' in account_type_lower:
        return 'Cost of Goods Sold'
    
    # Expenses
    elif 'expense' in account_type_lower:
        if 'other expense' in account_type_lower:
            return 'Other Expenses'
        else:
            return 'Operating Expenses'
    
    else:
        return 'Uncategorized'

def map_to_gaap_subcategory(account_type, detail_type, account_name):
    """Map to detailed GAAP subcategory"""
    account_type_lower = str(account_type).lower()
    detail_type_lower = str(detail_type).lower()
    account_name_lower = str(account_name).lower()
    
    # Assets
    if 'bank' in account_type_lower or 'checking' in detail_type_lower:
        return 'Cash and Cash Equivalents'
    elif 'accounts receivable' in account_type_lower:
        return 'Accounts Receivable'
    elif 'inventory' in detail_type_lower or 'inventory' in account_name_lower:
        return 'Inventory'
    elif 'prepaid' in detail_type_lower or 'prepaid' in account_name_lower:
        return 'Prepaid Expenses'
    elif 'fixed asset' in account_type_lower:
        return 'Property, Plant & Equipment'
    elif 'depreciation' in account_name_lower or 'amortization' in account_name_lower:
        return 'Accumulated Depreciation/Amortization'
    
    # Liabilities
    elif 'accounts payable' in account_type_lower:
        return 'Accounts Payable'
    elif 'credit card' in detail_type_lower or 'credit card' in account_name_lower:
        return 'Credit Cards Payable'
    elif 'accrued' in detail_type_lower or 'accrued' in account_name_lower:
        return 'Accrued Liabilities'
    elif 'deferred' in account_name_lower:
        return 'Deferred Revenue'
    elif 'loan' in account_name_lower or 'note payable' in detail_type_lower:
        return 'Notes/Loans Payable'
    
    # Equity
    elif 'equity' in account_type_lower:
        if 'paid-in' in account_name_lower or 'paid in' in account_name_lower:
            return 'Additional Paid-In Capital'
        elif 'retained' in account_name_lower:
            return 'Retained Earnings'
        elif 'stock' in account_name_lower:
            return 'Common/Preferred Stock'
        elif 'dividend' in account_name_lower:
            return 'Dividends'
        else:
            return "Owner's Equity"
    
    # Revenue
    elif 'income' in account_type_lower and 'sales' in detail_type_lower:
        return 'Product/Service Revenue'
    elif 'discount' in detail_type_lower or 'refund' in detail_type_lower:
        return 'Sales Discounts/Returns'
    elif 'other income' in account_type_lower or 'other operating income' in account_type_lower:
        return 'Other Operating Income'
    
    # COGS
    elif 'cost of goods sold' in account_type_lower:
        if 'supplies' in detail_type_lower or 'materials' in detail_type_lower:
            return 'Cost of Materials/Supplies'
        elif 'freight' in detail_type_lower or 'shipping' in detail_type_lower:
            return 'Freight & Shipping'
        elif 'labor' in account_name_lower:
            return 'Direct Labor'
        else:
            return 'Cost of Goods Sold'
    
    # Operating Expenses
    elif 'expense' in account_type_lower:
        if 'payroll' in detail_type_lower or 'salary' in account_name_lower:
            return 'Salaries & Wages'
        elif 'advertising' in detail_type_lower or 'promotional' in detail_type_lower:
            return 'Advertising & Marketing'
        elif 'legal' in detail_type_lower or 'professional' in detail_type_lower:
            return 'Legal & Professional Fees'
        elif 'insurance' in detail_type_lower or 'insurance' in account_name_lower:
            return 'Insurance'
        elif 'rent' in detail_type_lower or 'rent' in account_name_lower:
            return 'Rent'
        elif 'utilities' in detail_type_lower or 'utilities' in account_name_lower:
            return 'Utilities'
        elif 'software' in detail_type_lower or 'subscription' in detail_type_lower:
            return 'Software & Subscriptions'
        elif 'travel' in detail_type_lower or 'travel' in account_name_lower:
            return 'Travel & Entertainment'
        elif 'office' in detail_type_lower or 'office' in account_name_lower:
            return 'Office Expenses'
        elif 'r&d' in detail_type_lower or 'research' in detail_type_lower:
            return 'Research & Development'
        elif 'depreciation' in detail_type_lower or 'depreciation' in account_name_lower:
            return 'Depreciation Expense'
        elif 'amortization' in detail_type_lower or 'amortization' in account_name_lower:
            return 'Amortization Expense'
        elif 'interest' in detail_type_lower or 'interest' in account_name_lower:
            return 'Interest Expense'
        elif 'bank' in detail_type_lower and 'fee' in account_name_lower:
            return 'Bank Fees'
        elif 'other expense' in account_type_lower:
            return 'Other Non-Operating Expenses'
        else:
            return 'General Operating Expenses'
    
    else:
        return 'Other'

def determine_normal_balance(gaap_category):
    """Determine if account normally has debit or credit balance"""
    if gaap_category in ['Current Assets - Cash', 'Current Assets - Accounts Receivable', 
                         'Current Assets - Inventory', 'Current Assets - Other',
                         'Fixed Assets', 'Other Assets']:
        return 'Debit'
    elif gaap_category in ['Accumulated Depreciation/Amortization']:
        return 'Credit (Contra-Asset)'
    elif gaap_category in ['Current Liabilities - Accounts Payable', 'Current Liabilities - Other',
                           'Long-Term Liabilities']:
        return 'Credit'
    elif gaap_category in ['Equity', "Owner's Equity", 'Additional Paid-In Capital', 
                           'Retained Earnings', 'Common/Preferred Stock']:
        return 'Credit'
    elif 'Dividend' in gaap_category:
        return 'Debit (Contra-Equity)'
    elif gaap_category in ['Revenue', 'Product/Service Revenue', 'Other Operating Income', 'Other Income']:
        return 'Credit'
    elif 'Discount' in gaap_category or 'Return' in gaap_category:
        return 'Debit (Contra-Revenue)'
    elif gaap_category in ['Cost of Goods Sold', 'Cost of Materials/Supplies', 'Freight & Shipping', 
                           'Direct Labor']:
        return 'Debit'
    elif 'Expense' in gaap_category or gaap_category == 'Operating Expenses':
        return 'Debit'
    else:
        return 'Unknown'

# Apply mappings
print("🔄 Applying GAAP mappings...")
df['GAAP_Financial_Statement'] = df[col_account_type].apply(map_to_gaap_financial_statement)
df['GAAP_Category'] = df[col_account_type].apply(map_to_gaap_category)
df['GAAP_Subcategory'] = df.apply(
    lambda row: map_to_gaap_subcategory(
        row[col_account_type], 
        row[col_detail_type], 
        row[col_name]
    ), 
    axis=1
)
df['Normal_Balance'] = df['GAAP_Category'].apply(determine_normal_balance)

print("✓ Mappings applied")
print()

# Generate summary statistics
print("=" * 80)
print("GAAP MAPPING SUMMARY")
print("=" * 80)
print()

print("📊 BY FINANCIAL STATEMENT:")
print("-" * 80)
statement_summary = df['GAAP_Financial_Statement'].value_counts()
for statement, count in statement_summary.items():
    print(f"  {statement}: {count} accounts")
print()

print("📊 BY GAAP CATEGORY:")
print("-" * 80)
category_summary = df['GAAP_Category'].value_counts()
for category, count in category_summary.items():
    print(f"  {category}: {count} accounts")
print()

print("📊 BALANCE SHEET BREAKDOWN:")
print("-" * 80)
balance_sheet_accounts = df[df['GAAP_Financial_Statement'] == 'Balance Sheet']
bs_summary = balance_sheet_accounts['GAAP_Category'].value_counts()
for category, count in bs_summary.items():
    print(f"  {category}: {count} accounts")
print()

print("📊 INCOME STATEMENT BREAKDOWN:")
print("-" * 80)
income_stmt_accounts = df[df['GAAP_Financial_Statement'] == 'Income Statement']
is_summary = income_stmt_accounts['GAAP_Category'].value_counts()
for category, count in is_summary.items():
    print(f"  {category}: {count} accounts")
print()

# Save to Excel with multiple sheets
print("=" * 80)
print("EXPORTING TO EXCEL")
print("=" * 80)
print()

with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
    # Sheet 1: Complete mapping
    df.to_excel(writer, sheet_name='Complete_GAAP_Mapping', index=False)
    print("✓ Sheet 1: Complete GAAP Mapping")
    
    # Sheet 2: Balance Sheet accounts only
    balance_sheet_df = df[df['GAAP_Financial_Statement'] == 'Balance Sheet'].copy()
    balance_sheet_df = balance_sheet_df.sort_values(by=[col_number])
    balance_sheet_df.to_excel(writer, sheet_name='Balance_Sheet_Accounts', index=False)
    print(f"✓ Sheet 2: Balance Sheet Accounts ({len(balance_sheet_df)} accounts)")
    
    # Sheet 3: Income Statement accounts only
    income_stmt_df = df[df['GAAP_Financial_Statement'] == 'Income Statement'].copy()
    income_stmt_df = income_stmt_df.sort_values(by=[col_number])
    income_stmt_df.to_excel(writer, sheet_name='Income_Statement_Accounts', index=False)
    print(f"✓ Sheet 3: Income Statement Accounts ({len(income_stmt_df)} accounts)")
    
    # Sheet 4: Summary by Financial Statement
    summary_data = []
    for statement in ['Balance Sheet', 'Income Statement', 'Unknown']:
        stmt_accounts = df[df['GAAP_Financial_Statement'] == statement]
        categories = stmt_accounts['GAAP_Category'].value_counts()
        for category, count in categories.items():
            summary_data.append({
                'Financial_Statement': statement,
                'GAAP_Category': category,
                'Account_Count': count
            })
    
    summary_df = pd.DataFrame(summary_data)
    summary_df.to_excel(writer, sheet_name='Summary_by_Statement', index=False)
    print("✓ Sheet 4: Summary by Financial Statement")
    
    # Sheet 5: Sample GAAP financial statements structure
    gaap_structure = [
        {'Statement': 'Balance Sheet', 'Section': 'Assets', 'Line_Item': 'Current Assets', 'Accounts': 'Cash, AR, Inventory, Prepaid'},
        {'Statement': 'Balance Sheet', 'Section': 'Assets', 'Line_Item': 'Fixed Assets', 'Accounts': 'PP&E, Less: Accumulated Depreciation'},
        {'Statement': 'Balance Sheet', 'Section': 'Assets', 'Line_Item': 'Other Assets', 'Accounts': 'Intangibles, Long-term investments'},
        {'Statement': 'Balance Sheet', 'Section': 'Liabilities', 'Line_Item': 'Current Liabilities', 'Accounts': 'AP, Accrued expenses, Credit cards, Current portion of loans'},
        {'Statement': 'Balance Sheet', 'Section': 'Liabilities', 'Line_Item': 'Long-Term Liabilities', 'Accounts': 'Notes payable, Long-term debt'},
        {'Statement': 'Balance Sheet', 'Section': 'Equity', 'Line_Item': "Stockholders' Equity", 'Accounts': 'Common stock, Paid-in capital, Retained earnings'},
        {'Statement': '', 'Section': '', 'Line_Item': '', 'Accounts': ''},
        {'Statement': 'Income Statement', 'Section': 'Revenue', 'Line_Item': 'Net Revenue', 'Accounts': 'Product sales, Service revenue, Less: Returns/Discounts'},
        {'Statement': 'Income Statement', 'Section': 'COGS', 'Line_Item': 'Cost of Goods Sold', 'Accounts': 'Materials, Direct labor, Manufacturing overhead'},
        {'Statement': 'Income Statement', 'Section': 'Gross Profit', 'Line_Item': 'Gross Profit', 'Accounts': 'Revenue - COGS'},
        {'Statement': 'Income Statement', 'Section': 'Operating Expenses', 'Line_Item': 'Research & Development', 'Accounts': 'R&D salaries, R&D expenses, Prototyping'},
        {'Statement': 'Income Statement', 'Section': 'Operating Expenses', 'Line_Item': 'Sales & Marketing', 'Accounts': 'Marketing, Sales salaries, Advertising'},
        {'Statement': 'Income Statement', 'Section': 'Operating Expenses', 'Line_Item': 'General & Administrative', 'Accounts': 'Admin salaries, Rent, Insurance, Legal, Accounting'},
        {'Statement': 'Income Statement', 'Section': 'Operating Income', 'Line_Item': 'Operating Income', 'Accounts': 'Gross Profit - Operating Expenses'},
        {'Statement': 'Income Statement', 'Section': 'Other Income/Expense', 'Line_Item': 'Interest Expense', 'Accounts': 'Loan interest, Credit card interest'},
        {'Statement': 'Income Statement', 'Section': 'Other Income/Expense', 'Line_Item': 'Other Income/Expense', 'Accounts': 'Gain/loss on sale, Depreciation'},
        {'Statement': 'Income Statement', 'Section': 'Net Income', 'Line_Item': 'Net Income', 'Accounts': 'Operating Income +/- Other Income/Expense'},
    ]
    
    gaap_structure_df = pd.DataFrame(gaap_structure)
    gaap_structure_df.to_excel(writer, sheet_name='GAAP_Statement_Structure', index=False)
    print("✓ Sheet 5: GAAP Financial Statement Structure Reference")

print()
print("=" * 80)
print("✅ COMPLETE!")
print("=" * 80)
print(f"📁 Output file: {output_file}")
print()
print("📊 Summary:")
print(f"  Total accounts mapped: {len(df)}")
print(f"  Balance Sheet accounts: {len(balance_sheet_df)}")
print(f"  Income Statement accounts: {len(income_stmt_df)}")
print()
print("🎯 New columns added:")
print("  • GAAP_Financial_Statement (Balance Sheet, Income Statement)")
print("  • GAAP_Category (Current Assets, Revenue, Operating Expenses, etc.)")
print("  • GAAP_Subcategory (Cash, AR, Inventory, Salaries, etc.)")
print("  • Normal_Balance (Debit or Credit)")
print()
print("=" * 80)

