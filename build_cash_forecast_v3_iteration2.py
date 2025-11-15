#!/usr/bin/env python3
"""
Build Cash Forecast - ITERATION 2
Smart auto-categorization based on vendor patterns + GL overrides
"""

import os
import pandas as pd
from supabase import create_client, Client
from datetime import datetime
from dotenv import load_dotenv
import re

load_dotenv('.env.local')

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Missing Supabase credentials")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("=" * 80)
print("💰 CASH FORECAST BUILDER - ITERATION 2")
print("=" * 80)

# =============================================================================
# SMART CATEGORIZATION RULES
# =============================================================================
VENDOR_RULES = {
    # Labor - Operations
    'customer care': ('Labor - Operations', 'Support'),
    'warehouse': ('Labor - Operations', 'Warehouse'),
    'fulfillment': ('Labor - Operations', 'Warehouse'),
    'facility': ('Labor - Operations', 'Facility'),
    'maintenance': ('Labor - Operations', 'Facility'),
    
    # Labor - G&A
    'controller': ('Labor - G&A', 'Finance'),
    'accounting': ('Labor - G&A', 'Finance'),
    'paylocity': ('Labor - G&A', 'Payroll'),
    'payroll': ('Labor - G&A', 'Payroll'),
    'sales': ('Labor - G&A', 'Sales'),
    'commission': ('Labor - G&A', 'Sales'),
    'legal': ('OpEx - Professional Services', 'Legal'),
    'attorney': ('OpEx - Professional Services', 'Legal'),
    
    # Labor - R&D
    'gryphon': ('Labor - R&D', 'Engineering'),
    'firmware': ('Labor - R&D', 'Engineering'),
    'software': ('Labor - R&D', 'Engineering'),
    'engineering': ('Labor - R&D', 'Engineering'),
    'cto': ('Labor - R&D', 'Product'),
    'product manager': ('Labor - R&D', 'Product'),
    
    # NRE/R&D
    'cable television laboratories': ('NRE', 'Certification'),
    'cable lab': ('NRE', 'Certification'),
    'cablelabs': ('NRE', 'Certification'),
    'certification': ('NRE', 'Certification'),
    'testing': ('NRE', 'Testing'),
    
    # Inventory/COGS
    'mtn high-technology': ('Inventory', 'Finished Goods'),
    'mtn': ('Inventory', 'Finished Goods'),
    'askey': ('Inventory', 'Finished Goods'),
    'compal': ('Inventory', 'Finished Goods'),
    't&w': ('Inventory', 'Components'),
    'flexport': ('Inventory', 'Freight'),
    'shipping': ('Inventory', 'Freight'),
    'fedex': ('Inventory', 'Freight'),
    'ups': ('Inventory', 'Freight'),
    
    # OpEx - IT/Software
    'amazon web servi': ('OpEx - IT/Software', 'AWS'),
    'aws': ('OpEx - IT/Software', 'AWS'),
    'google': ('OpEx - IT/Software', 'Google Workspace'),
    'microsoft': ('OpEx - IT/Software', 'Microsoft'),
    'salesforce': ('OpEx - IT/Software', 'Salesforce'),
    'quickbooks': ('OpEx - IT/Software', 'QuickBooks'),
    'slack': ('OpEx - IT/Software', 'Slack'),
    'zoom': ('OpEx - IT/Software', 'Zoom'),
    'adobe': ('OpEx - IT/Software', 'Adobe'),
    'dropbox': ('OpEx - IT/Software', 'Dropbox'),
    
    # OpEx - Other
    'insurance': ('OpEx - Insurance', 'Insurance'),
    'rent': ('OpEx - Rent/Facilities', 'Rent'),
    'lease': ('OpEx - Rent/Facilities', 'Lease'),
    'bank fee': ('OpEx - Banking', 'Bank Fees'),
    'wire': ('OpEx - Banking', 'Wire Fees'),
    
    # Marketing
    'facebook': ('Marketing - Digital', 'Facebook Ads'),
    'meta': ('Marketing - Digital', 'Meta Ads'),
    'google ads': ('Marketing - Digital', 'Google Ads'),
    'linkedin': ('Marketing - Digital', 'LinkedIn Ads'),
    'amazon advertising': ('Marketing - Digital', 'Amazon Ads'),
}

def smart_categorize(vendor, description, memo=''):
    """
    Smart categorization based on vendor name, description, memo
    Returns: (Category, Subcategory)
    """
    search_text = f"{vendor} {description} {memo}".lower()
    
    # Check each rule
    for keyword, (category, subcategory) in VENDOR_RULES.items():
        if keyword in search_text:
            return (category, subcategory)
    
    # Special patterns
    if 'tide rock' in search_text or 'corporate xfer' in search_text:
        return ('Internal Transfer', 'Tide Rock')
    
    if 'wire/out' in search_text or 'ach' in search_text:
        return ('Uncategorized', 'Wire/ACH - Needs Review')
    
    return ('Uncategorized', '')

# =============================================================================
# PULL DATA
# =============================================================================
print("\n1️⃣ Pulling data from BOSS...")

all_expenses = []

# Get GL Overrides first
print("   Fetching GL overrides...")
overrides_response = supabase.table('gl_transaction_overrides').select('*').execute()
overrides = overrides_response.data if overrides_response.data else []
override_map = {o['transaction_id']: o for o in overrides}
print(f"   ✅ {len(overrides)} GL overrides")

# QuickBooks Bills
print("   Fetching QB Bills...")
bills_response = supabase.table('quickbooks_bills').select('*').execute()
bills = bills_response.data if bills_response.data else []
print(f"   ✅ {len(bills)} bills")

for bill in bills:
    override = override_map.get(str(bill['id']))
    
    if override:
        category = f"{override.get('override_category', 'Uncategorized').title()}"
        subcategory = override.get('override_account_type', '')
    else:
        category, subcategory = smart_categorize(
            bill.get('vendor_name', ''),
            bill.get('vendor_name', ''),
            ''
        )
    
    all_expenses.append({
        'Source': 'QB Bill',
        'Date': bill.get('bill_date'),
        'Vendor': bill.get('vendor_name', 'Unknown'),
        'Amount': abs(float(bill.get('total_amount', 0))),
        'Category': category,
        'Subcategory': subcategory,
        'Balance': float(bill.get('balance', 0)),
        'Due_Date': bill.get('due_date'),
        'ID': bill.get('id')
    })

# QuickBooks Expenses
print("   Fetching QB Expenses...")
expenses_response = supabase.table('quickbooks_expenses').select('*').execute()
expenses = expenses_response.data if expenses_response.data else []
print(f"   ✅ {len(expenses)} expenses")

for exp in expenses:
    override = override_map.get(str(exp['id']))
    
    if override:
        category = f"{override.get('override_category', 'Uncategorized').title()}"
        subcategory = override.get('override_account_type', '')
    else:
        category, subcategory = smart_categorize(
            exp.get('payee', ''),
            exp.get('payee', ''),
            exp.get('memo', '')
        )
    
    all_expenses.append({
        'Source': 'QB Expense',
        'Date': exp.get('expense_date'),
        'Vendor': exp.get('payee', 'Unknown'),
        'Amount': abs(float(exp.get('total_amt', 0))),
        'Category': category,
        'Subcategory': subcategory,
        'Balance': 0,
        'Due_Date': None,
        'ID': exp.get('id')
    })

# Bank Statements
print("   Fetching Bank transactions...")
bank_response = supabase.table('bank_statements').select('*').limit(1000).execute()
bank_txns = bank_response.data if bank_response.data else []
print(f"   ✅ {len(bank_txns)} bank transactions")

for txn in bank_txns:
    amt = float(txn.get('amount', 0))
    if amt < 0:  # Expenses only
        category, subcategory = smart_categorize(
            txn.get('description', ''),
            txn.get('description', ''),
            txn.get('memo', '')
        )
        
        all_expenses.append({
            'Source': 'Bank',
            'Date': txn.get('transaction_date'),
            'Vendor': txn.get('description', 'Unknown'),
            'Amount': abs(amt),
            'Category': category,
            'Subcategory': subcategory,
            'Balance': 0,
            'Due_Date': None,
            'ID': txn.get('id')
        })

# Ramp Transactions (use charge_usd and payee)
print("   Fetching Ramp transactions...")
ramp_response = supabase.table('ramp_transactions').select('*').limit(1000).execute()
ramp_txns = ramp_response.data if ramp_response.data else []
print(f"   ✅ {len(ramp_txns)} Ramp transactions")

for txn in ramp_txns:
    charge = txn.get('charge_usd') or 0
    payment = txn.get('payment_usd') or 0
    amt = abs(float(charge)) if charge else abs(float(payment)) if payment else 0
    
    if amt > 0:
        category, subcategory = smart_categorize(
            txn.get('payee', ''),
            txn.get('memo', ''),
            txn.get('class', '')
        )
        
        all_expenses.append({
            'Source': 'Ramp',
            'Date': txn.get('transaction_date'),
            'Vendor': txn.get('payee', 'Unknown'),
            'Amount': amt,
            'Category': category,
            'Subcategory': subcategory,
            'Balance': 0,
            'Due_Date': None,
            'ID': txn.get('id')
        })

# =============================================================================
# ANALYZE
# =============================================================================
print(f"\n2️⃣ Analyzing {len(all_expenses)} transactions...")

df = pd.DataFrame(all_expenses)
df['Date'] = pd.to_datetime(df['Date'], errors='coerce')
df = df.sort_values('Date', ascending=False)

# Filter out zero amounts
df = df[df['Amount'] > 0]

print(f"\n   ✅ {len(df)} transactions with amounts > 0")

# Summary stats
print("\n   💰 BY CATEGORY:")
cat_summary = df.groupby('Category')['Amount'].agg(['count', 'sum']).sort_values('sum', ascending=False)
for idx, row in cat_summary.iterrows():
    print(f"      {idx:40} {int(row['count']):4} txns  ${row['sum']:>14,.2f}")

print(f"\n   📊 TOTAL SPEND: ${df['Amount'].sum():,.2f}")

# Categorization success rate
uncategorized = len(df[df['Category'] == 'Uncategorized'])
categorized = len(df) - uncategorized
success_rate = (categorized / len(df)) * 100 if len(df) > 0 else 0
print(f"\n   ✅ Categorization: {categorized}/{len(df)} ({success_rate:.1f}%)")
print(f"   ⚠️  Still Uncategorized: {uncategorized} transactions (${df[df['Category'] == 'Uncategorized']['Amount'].sum():,.2f})")

# Top vendors still uncategorized
if uncategorized > 0:
    print("\n   🔍 TOP 10 UNCATEGORIZED VENDORS (need manual review):")
    uncat = df[df['Category'] == 'Uncategorized'].groupby('Vendor')['Amount'].sum().sort_values(ascending=False).head(10)
    for vendor, amt in uncat.items():
        print(f"      {vendor[:60]:60} ${amt:>12,.2f}")

# =============================================================================
# EXPORT
# =============================================================================
print("\n3️⃣ Exporting to Excel...")

output_file = "BDI_Cash_Forecast_Categorized_v2.xlsx"

with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
    # Sheet 1: All Expenses
    df_export = df[['Date', 'Source', 'Vendor', 'Category', 'Subcategory', 'Amount', 'Balance', 'Due_Date']].copy()
    df_export['Date'] = df_export['Date'].dt.strftime('%Y-%m-%d')
    df_export['Due_Date'] = pd.to_datetime(df_export['Due_Date'], errors='coerce').dt.strftime('%Y-%m-%d')
    df_export.to_excel(writer, sheet_name='All Expenses', index=False)
    
    # Sheet 2: Category Summary
    cat_summary.to_excel(writer, sheet_name='By Category')
    
    # Sheet 3: Labor Breakdown
    labor_df = df[df['Category'].str.contains('Labor', na=False)].copy()
    if not labor_df.empty:
        labor_summary = labor_df.groupby(['Category', 'Subcategory', 'Vendor'])['Amount'].sum().reset_index()
        labor_summary = labor_summary.sort_values(['Category', 'Amount'], ascending=[True, False])
        labor_summary.to_excel(writer, sheet_name='Labor Breakdown', index=False)
    
    # Sheet 4: OpEx Breakdown
    opex_df = df[df['Category'].str.contains('OpEx', na=False)].copy()
    if not opex_df.empty:
        opex_summary = opex_df.groupby(['Category', 'Subcategory', 'Vendor'])['Amount'].sum().reset_index()
        opex_summary = opex_summary.sort_values(['Category', 'Amount'], ascending=[True, False])
        opex_summary.to_excel(writer, sheet_name='OpEx Breakdown', index=False)
    
    # Sheet 5: NRE Breakdown
    nre_df = df[df['Category'].str.contains('NRE', na=False)].copy()
    if not nre_df.empty:
        nre_summary = nre_df.groupby(['Subcategory', 'Vendor'])['Amount'].sum().reset_index()
        nre_summary = nre_summary.sort_values('Amount', ascending=False)
        nre_summary.to_excel(writer, sheet_name='NRE Breakdown', index=False)
    
    # Sheet 6: Inventory Breakdown
    inv_df = df[df['Category'].str.contains('Inventory', na=False)].copy()
    if not inv_df.empty:
        inv_summary = inv_df.groupby(['Subcategory', 'Vendor'])['Amount'].sum().reset_index()
        inv_summary = inv_summary.sort_values('Amount', ascending=False)
        inv_summary.to_excel(writer, sheet_name='Inventory Breakdown', index=False)
    
    # Sheet 7: Uncategorized (needs review)
    uncat_df = df[df['Category'] == 'Uncategorized'][['Date', 'Vendor', 'Amount', 'Source']].copy()
    if not uncat_df.empty:
        uncat_df['Date'] = pd.to_datetime(uncat_df['Date']).dt.strftime('%Y-%m-%d')
        uncat_df = uncat_df.sort_values('Amount', ascending=False)
        uncat_df.to_excel(writer, sheet_name='Needs Categorization', index=False)
    
    # Sheet 8: Weekly Spend Summary
    df_weekly = df.copy()
    df_weekly['Week'] = df_weekly['Date'].dt.to_period('W').dt.start_time
    weekly_pivot = df_weekly.pivot_table(
        index='Category',
        columns='Week',
        values='Amount',
        aggfunc='sum',
        fill_value=0
    )
    weekly_pivot['Total'] = weekly_pivot.sum(axis=1)
    weekly_pivot = weekly_pivot.sort_values('Total', ascending=False)
    weekly_pivot.to_excel(writer, sheet_name='Weekly Spend')

print(f"   ✅ Excel created: {output_file}")
print(f"   📊 {len(df)} transactions across 8 sheets")

print("\n" + "=" * 80)
print("✅ ITERATION 2 COMPLETE!")
print("=" * 80)
print("\nNext Steps:")
print("1. Review 'Needs Categorization' sheet")
print("2. Check Labor Breakdown for missing employees")
print("3. Verify OpEx recurring expenses")
print("4. Ready to build dynamic Cash Forecast template!")

