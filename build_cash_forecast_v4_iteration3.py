#!/usr/bin/env python3
"""
Build Cash Forecast - ITERATION 3
Apply user corrections + map to new GL Codes from CoA project
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
print("💰 CASH FORECAST BUILDER - ITERATION 3 (FINAL)")
print("   With User Corrections + GL Code Mapping")
print("=" * 80)

# =============================================================================
# GL CODE MAPPING (from our CoA project)
# =============================================================================
GL_CODE_MAP = {
    # Labor - Operations (6000s)
    'Labor - Operations - Support': {'gl_code': '6210', 'gl_name': 'Salaries - Customer Support'},
    'Labor - Operations - Warehouse': {'gl_code': '6220', 'gl_name': 'Salaries - Warehouse'},
    'Labor - Operations - Repair': {'gl_code': '6230', 'gl_name': 'Salaries - Repair Center'},
    
    # Labor - G&A (6100s)
    'Labor - G&A - Finance': {'gl_code': '6110', 'gl_name': 'Salaries - Accounting/Finance'},
    'Labor - G&A - Executive': {'gl_code': '6100', 'gl_name': 'Salaries - Executive'},
    'Labor - G&A - Sales': {'gl_code': '6120', 'gl_name': 'Salaries - Sales'},
    'Labor - G&A - Payroll': {'gl_code': '6150', 'gl_name': 'Payroll Taxes & Benefits'},
    
    # Labor - R&D (9000s - from our NRE restructuring)
    'Labor - R&D - Engineering': {'gl_code': '9100', 'gl_name': 'R&D - Firmware Development'},
    'Labor - R&D - Product': {'gl_code': '9200', 'gl_name': 'R&D - Product Management'},
    
    # Labor - Marketing (6400s)
    'Labor - Marketing - Ops': {'gl_code': '6410', 'gl_name': 'Marketing Salaries'},
    
    # NRE/R&D (9000s)
    'NRE - Certification': {'gl_code': '9300', 'gl_name': 'R&D - Certification & Testing'},
    'NRE - Testing': {'gl_code': '9310', 'gl_name': 'R&D - Lab & Testing Equipment'},
    'NRE - Prototyping': {'gl_code': '9320', 'gl_name': 'R&D - Prototyping'},
    
    # Inventory/COGS (5000s)
    'Inventory - Finished Goods': {'gl_code': '5010', 'gl_name': 'COGS - Finished Goods'},
    'Inventory - Components': {'gl_code': '5020', 'gl_name': 'COGS - Components'},
    'Inventory - Freight': {'gl_code': '5030', 'gl_name': 'COGS - Freight & Shipping'},
    'Inventory - Import Costs': {'gl_code': '5040', 'gl_name': 'COGS - Import/Customs'},
    'Inventory - Prepaid': {'gl_code': '1250', 'gl_name': 'Prepaid Inventory'},
    
    # OpEx - IT/Software (6500s - DevOps from our restructuring)
    'OpEx - IT/Software - AWS': {'gl_code': '6510', 'gl_name': 'DevOps - Cloud Services (AWS)'},
    'OpEx - IT/Software - Other': {'gl_code': '6520', 'gl_name': 'DevOps - Software Subscriptions'},
    
    # OpEx - Other (6300s)
    'OpEx - Rent/Facilities': {'gl_code': '6310', 'gl_name': 'Rent & Facilities'},
    'OpEx - Insurance': {'gl_code': '6320', 'gl_name': 'Insurance'},
    'OpEx - Professional Services': {'gl_code': '6340', 'gl_name': 'Professional Fees - Legal/Accounting'},
    'OpEx - Banking': {'gl_code': '6350', 'gl_name': 'Bank Fees & Wire Charges'},
    
    # Operations - Repair Center
    'Operations - Repair Center': {'gl_code': '6240', 'gl_name': 'Repair Center Operations'},
    
    # Marketing (6400s)
    'Marketing - Digital': {'gl_code': '6420', 'gl_name': 'Marketing - Digital Advertising'},
}

# =============================================================================
# ENHANCED CATEGORIZATION RULES (with user corrections)
# =============================================================================
VENDOR_RULES = {
    # PAYROLL
    '334843 boundless': ('Labor - G&A - Payroll', 'Payroll Processing'),
    'boundless1364227403': ('Labor - G&A - Payroll', 'Payroll Processing'),
    'paylocity': ('Labor - G&A - Payroll', 'Payroll Taxes'),
    
    # LABOR - G&A
    'karen e drennan': ('Labor - G&A - Finance', 'Contract Controller'),
    'karen drennan': ('Labor - G&A - Finance', 'Contract Controller'),
    'controller': ('Labor - G&A - Finance', 'Controller'),
    'steven cistulli': ('Labor - G&A - Executive', 'Owner Expenses'),
    
    # LABOR - Operations
    'deel': ('Labor - Operations - Support', 'Customer Care Contract Labor'),
    'customer care': ('Labor - Operations - Support', 'Customer Support'),
    'complete catv': ('Operations - Repair Center', 'Repair Center Services'),
    
    # LABOR - R&D
    'gryphon': ('Labor - R&D - Engineering', 'Engineering Services'),
    'firmware': ('Labor - R&D - Engineering', 'Firmware Development'),
    
    # NRE/Certification
    'cable television laboratories': ('NRE - Certification', 'Certification Testing'),
    'cable lab': ('NRE - Certification', 'Certification Testing'),
    'cablelabs': ('NRE - Certification', 'Certification Testing'),
    'cable television9186939000': ('NRE - Certification', 'Certification Testing'),
    
    # INVENTORY
    'mtn high-technology': ('Inventory - Finished Goods', 'MTN - Finished Goods'),
    'mtn': ('Inventory - Finished Goods', 'MTN - Finished Goods'),
    'askey': ('Inventory - Finished Goods', 'Askey - Finished Goods'),
    'compal': ('Inventory - Finished Goods', 'Compal - Finished Goods'),
    'atel': ('Inventory - Prepaid', 'ATEL - Prepaid Inventory'),
    'ol usa': ('Inventory - Import Costs', 'Import/Customs Costs'),
    't&w': ('Inventory - Components', 'Components'),
    'flexport': ('Inventory - Freight', 'Freight Services'),
    
    # OPEX
    'baker & hostetler': ('OpEx - Professional Services', 'Legal Services'),
    'baker hostetler': ('OpEx - Professional Services', 'Legal Services'),
    'amazon web servi': ('OpEx - IT/Software - AWS', 'AWS Cloud Services'),
    'aws': ('OpEx - IT/Software - AWS', 'AWS Cloud Services'),
    'google': ('OpEx - IT/Software - Other', 'Google Workspace'),
    'microsoft': ('OpEx - IT/Software - Other', 'Microsoft'),
    'insurance': ('OpEx - Insurance', 'Insurance'),
    'wire': ('OpEx - Banking', 'Wire Fees'),
    'bank fee': ('OpEx - Banking', 'Bank Fees'),
    
    # MARKETING
    'facebook': ('Marketing - Digital', 'Facebook Ads'),
    'google ads': ('Marketing - Digital', 'Google Ads'),
    
    # INTERNAL
    'tide rock': ('Internal Transfer', 'Tide Rock Transfer'),
    'corporate xfer': ('Internal Transfer', 'Internal Transfer'),
}

def smart_categorize(vendor, description, memo=''):
    """Enhanced categorization with user corrections"""
    search_text = f"{vendor} {description} {memo}".lower()
    
    # Check each rule
    for keyword, (category, subcategory) in VENDOR_RULES.items():
        if keyword in search_text:
            return (category, subcategory)
    
    # Wire/ACH patterns
    if 'wire/out' in search_text or 'ach' in search_text:
        return ('OpEx - Banking', 'Wire/ACH Transfer')
    
    return ('Uncategorized', '')

def get_gl_code(category, subcategory=''):
    """Get GL code based on category"""
    key = f"{category}"
    if key in GL_CODE_MAP:
        return GL_CODE_MAP[key]['gl_code'], GL_CODE_MAP[key]['gl_name']
    
    # Try with subcategory
    if subcategory and 'AWS' in subcategory:
        return '6510', 'DevOps - Cloud Services (AWS)'
    
    return '', ''

# =============================================================================
# PULL DATA
# =============================================================================
print("\n1️⃣ Pulling data from BOSS...")

all_expenses = []

# Get GL Overrides
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
    
    gl_code, gl_name = get_gl_code(category, subcategory)
    
    all_expenses.append({
        'Source': 'QB Bill',
        'Date': bill.get('bill_date'),
        'Vendor': bill.get('vendor_name', 'Unknown'),
        'Amount': abs(float(bill.get('total_amount', 0))),
        'Category': category,
        'Subcategory': subcategory,
        'GL_Code': gl_code,
        'GL_Name': gl_name,
        'Balance': float(bill.get('balance', 0)),
        'Due_Date': bill.get('due_date'),
        'Status': 'Unpaid' if float(bill.get('balance', 0)) > 0 else 'Paid',
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
    
    gl_code, gl_name = get_gl_code(category, subcategory)
    
    all_expenses.append({
        'Source': 'QB Expense',
        'Date': exp.get('expense_date'),
        'Vendor': exp.get('payee', 'Unknown'),
        'Amount': abs(float(exp.get('total_amt', 0))),
        'Category': category,
        'Subcategory': subcategory,
        'GL_Code': gl_code,
        'GL_Name': gl_name,
        'Balance': 0,
        'Due_Date': None,
        'Status': 'Paid',
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
        
        gl_code, gl_name = get_gl_code(category, subcategory)
        
        all_expenses.append({
            'Source': 'Bank',
            'Date': txn.get('transaction_date'),
            'Vendor': txn.get('description', 'Unknown'),
            'Amount': abs(amt),
            'Category': category,
            'Subcategory': subcategory,
            'GL_Code': gl_code,
            'GL_Name': gl_name,
            'Balance': 0,
            'Due_Date': None,
            'Status': 'Paid',
            'ID': txn.get('id')
        })

# Ramp Transactions
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
        
        gl_code, gl_name = get_gl_code(category, subcategory)
        
        all_expenses.append({
            'Source': 'Ramp',
            'Date': txn.get('transaction_date'),
            'Vendor': txn.get('payee', 'Unknown'),
            'Amount': amt,
            'Category': category,
            'Subcategory': subcategory,
            'GL_Code': gl_code,
            'GL_Name': gl_name,
            'Balance': 0,
            'Due_Date': None,
            'Status': 'Paid',
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
for idx, row in cat_summary.head(15).iterrows():
    print(f"      {idx:45} {int(row['count']):4} txns  ${row['sum']:>14,.2f}")

print(f"\n   📊 TOTAL SPEND: ${df['Amount'].sum():,.2f}")

# Categorization success rate
uncategorized = len(df[df['Category'] == 'Uncategorized'])
categorized = len(df) - uncategorized
success_rate = (categorized / len(df)) * 100 if len(df) > 0 else 0
print(f"\n   ✅ Categorization: {categorized}/{len(df)} ({success_rate:.1f}%)")
print(f"   ⚠️  Still Uncategorized: {uncategorized} transactions (${df[df['Category'] == 'Uncategorized']['Amount'].sum():,.2f})")

# GL Code coverage
with_gl_code = len(df[df['GL_Code'] != ''])
gl_coverage = (with_gl_code / len(df)) * 100 if len(df) > 0 else 0
print(f"   📋 GL Code Mapped: {with_gl_code}/{len(df)} ({gl_coverage:.1f}%)")

# =============================================================================
# EXPORT FOR BOOKKEEPER
# =============================================================================
print("\n3️⃣ Creating Bookkeeper-Ready Excel...")

output_file = "BDI_Cash_Forecast_FINAL_for_Bookkeeper.xlsx"

with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
    # Sheet 1: All Expenses (Master List)
    df_export = df[['Date', 'Source', 'Vendor', 'Category', 'Subcategory', 'GL_Code', 'GL_Name', 'Amount', 'Status', 'Balance', 'Due_Date']].copy()
    df_export['Date'] = df_export['Date'].dt.strftime('%Y-%m-%d')
    df_export['Due_Date'] = pd.to_datetime(df_export['Due_Date'], errors='coerce').dt.strftime('%Y-%m-%d')
    df_export = df_export.sort_values('Date', ascending=False)
    df_export.to_excel(writer, sheet_name='All Expenses', index=False)
    
    # Sheet 2: LABOR DETAILED (for payroll breakdown)
    labor_df = df[df['Category'].str.contains('Labor', na=False)].copy()
    if not labor_df.empty:
        labor_detail = labor_df[['Date', 'Vendor', 'Category', 'Subcategory', 'GL_Code', 'Amount', 'Status']].copy()
        labor_detail['Date'] = pd.to_datetime(labor_detail['Date']).dt.strftime('%Y-%m-%d')
        labor_detail['Week'] = pd.to_datetime(labor_detail['Date']).dt.to_period('W').astype(str)
        labor_detail = labor_detail.sort_values(['Category', 'Date'], ascending=[True, False])
        labor_detail.to_excel(writer, sheet_name='Labor Detail', index=False)
        
        # Labor Summary by Category
        labor_summary = labor_df.groupby(['Category', 'Subcategory', 'GL_Code', 'Vendor'])['Amount'].sum().reset_index()
        labor_summary = labor_summary.sort_values(['Category', 'Amount'], ascending=[True, False])
        labor_summary.to_excel(writer, sheet_name='Labor Summary', index=False)
    
    # Sheet 3: OPEX DETAILED
    opex_df = df[df['Category'].str.contains('OpEx', na=False)].copy()
    if not opex_df.empty:
        opex_detail = opex_df[['Date', 'Vendor', 'Subcategory', 'GL_Code', 'Amount']].copy()
        opex_detail['Date'] = pd.to_datetime(opex_detail['Date']).dt.strftime('%Y-%m-%d')
        opex_detail = opex_detail.sort_values('Date', ascending=False)
        opex_detail.to_excel(writer, sheet_name='OpEx Detail', index=False)
    
    # Sheet 4: INVENTORY/COGS
    inv_df = df[df['Category'].str.contains('Inventory', na=False)].copy()
    if not inv_df.empty:
        inv_detail = inv_df[['Date', 'Vendor', 'Subcategory', 'GL_Code', 'Amount', 'Status', 'Balance', 'Due_Date']].copy()
        inv_detail['Date'] = pd.to_datetime(inv_detail['Date']).dt.strftime('%Y-%m-%d')
        inv_detail['Due_Date'] = pd.to_datetime(inv_detail['Due_Date'], errors='coerce').dt.strftime('%Y-%m-%d')
        inv_detail = inv_detail.sort_values('Date', ascending=False)
        inv_detail.to_excel(writer, sheet_name='Inventory_COGS', index=False)
    
    # Sheet 5: NRE/R&D
    nre_df = df[df['Category'].str.contains('NRE|R&D', na=False)].copy()
    if not nre_df.empty:
        nre_detail = nre_df[['Date', 'Vendor', 'Subcategory', 'GL_Code', 'Amount']].copy()
        nre_detail['Date'] = pd.to_datetime(nre_detail['Date']).dt.strftime('%Y-%m-%d')
        nre_detail = nre_detail.sort_values('Date', ascending=False)
        nre_detail.to_excel(writer, sheet_name='NRE_RD', index=False)
    
    # Sheet 6: Operations (Repair Center)
    ops_df = df[df['Category'].str.contains('Operations', na=False)].copy()
    if not ops_df.empty:
        ops_detail = ops_df[['Date', 'Vendor', 'Subcategory', 'GL_Code', 'Amount']].copy()
        ops_detail['Date'] = pd.to_datetime(ops_detail['Date']).dt.strftime('%Y-%m-%d')
        ops_detail = ops_detail.sort_values('Date', ascending=False)
        ops_detail.to_excel(writer, sheet_name='Operations', index=False)
    
    # Sheet 7: Weekly Summary by GL Code
    df_weekly = df[df['GL_Code'] != ''].copy()
    if not df_weekly.empty:
        df_weekly['Week'] = df_weekly['Date'].dt.to_period('W').dt.start_time
        weekly_pivot = df_weekly.pivot_table(
            index=['GL_Code', 'GL_Name', 'Category'],
            columns='Week',
            values='Amount',
            aggfunc='sum',
            fill_value=0
        )
        weekly_pivot['Total'] = weekly_pivot.sum(axis=1)
        weekly_pivot = weekly_pivot.sort_values('Total', ascending=False)
        weekly_pivot.to_excel(writer, sheet_name='Weekly by GL Code')
    
    # Sheet 8: Uncategorized (Needs Review)
    uncat_df = df[df['Category'] == 'Uncategorized'][['Date', 'Vendor', 'Amount', 'Source']].copy()
    if not uncat_df.empty:
        uncat_df['Date'] = pd.to_datetime(uncat_df['Date']).dt.strftime('%Y-%m-%d')
        uncat_df = uncat_df.sort_values('Amount', ascending=False)
        uncat_df.to_excel(writer, sheet_name='Needs Review', index=False)

print(f"   ✅ Excel created: {output_file}")
print(f"   📊 {len(df)} transactions organized into professional sheets")

print("\n" + "=" * 80)
print("✅ ITERATION 3 COMPLETE - READY FOR BOOKKEEPER!")
print("=" * 80)
print("\n📁 File: BDI_Cash_Forecast_FINAL_for_Bookkeeper.xlsx")
print("\nSheets included:")
print("  1. All Expenses - Master list with GL codes")
print("  2. Labor Detail - Payroll breakdown by person/date")
print("  3. Labor Summary - Totals by category")
print("  4. OpEx Detail - Operating expenses")
print("  5. Inventory_COGS - Inventory purchases")
print("  6. NRE_RD - R&D/Certification expenses")
print("  7. Operations - Repair center costs")
print("  8. Weekly by GL Code - Pivot for analysis")
print("  9. Needs Review - Uncategorized items")

