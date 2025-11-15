#!/usr/bin/env python3
"""
Build Cash Forecast Labor & OpEx Tabs from Real BOSS Data
Pull from: GL transactions, Bank statements, Ramp transactions, QuickBooks
"""

import os
import pandas as pd
from supabase import create_client, Client
from datetime import datetime, timedelta
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

# Supabase connection
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: Missing Supabase credentials in .env.local")
    print("   Need: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("=" * 80)
print("📊 BUILDING CASH FORECAST FROM REAL BOSS DATA")
print("=" * 80)

# =============================================================================
# STEP 1: Pull Labor Data from GL Transactions
# =============================================================================
print("\n1️⃣ Fetching Labor Spend from GL Transactions...")
print("-" * 80)

try:
    # Get QuickBooks bills categorized as labor
    labor_response = supabase.table('quickbooks_bills').select(
        'id, txn_date, bill_date, vendor_ref, total_amt, balance, due_date, doc_number'
    ).execute()
    
    bills = labor_response.data if labor_response.data else []
    print(f"   ✅ Fetched {len(bills)} bills from QuickBooks")
    
    # Get overrides to identify labor categories
    overrides_response = supabase.table('gl_transaction_overrides').select(
        'transaction_id, override_category, override_account_type'
    ).execute()
    
    overrides = overrides_response.data if overrides_response.data else []
    print(f"   ✅ Fetched {len(overrides)} GL overrides")
    
    # Create override lookup
    override_map = {}
    for o in overrides:
        override_map[o['transaction_id']] = {
            'category': o['override_category'],
            'account_type': o['override_account_type']
        }
    
    # Filter for labor-related bills
    labor_bills = []
    for bill in bills:
        override = override_map.get(str(bill['id']))
        if override and override['category'] in ['labor', 'opex']:
            bill['override_category'] = override['category']
            bill['override_account_type'] = override['account_type']
            labor_bills.append(bill)
    
    print(f"   📊 Found {len(labor_bills)} labor/opex bills")
    
    # Show sample
    if labor_bills:
        print("\n   Sample labor transactions:")
        for bill in labor_bills[:5]:
            print(f"      {bill.get('bill_date', 'N/A')[:10]} | {bill.get('vendor_ref', 'Unknown')[:30]:30} | ${float(bill.get('total_amt', 0)):>10,.2f} | {bill.get('override_account_type', 'Uncategorized')}")

except Exception as e:
    print(f"   ❌ Error fetching labor data: {e}")
    labor_bills = []

# =============================================================================
# STEP 2: Pull Bank Statement Data
# =============================================================================
print("\n\n2️⃣ Fetching Bank Statement Transactions...")
print("-" * 80)

try:
    bank_response = supabase.table('bank_statements').select(
        'id, transaction_date, description, amount, balance, transaction_type, category, memo'
    ).order('transaction_date', desc=True).limit(500).execute()
    
    bank_txns = bank_response.data if bank_response.data else []
    print(f"   ✅ Fetched {len(bank_txns)} bank transactions (last 500)")
    
    if bank_txns:
        print("\n   Sample bank transactions:")
        for txn in bank_txns[:10]:
            amt = float(txn.get('amount', 0))
            print(f"      {txn.get('transaction_date', 'N/A')[:10]} | {txn.get('description', 'Unknown')[:40]:40} | ${amt:>10,.2f} | {txn.get('category', 'Uncategorized')}")

except Exception as e:
    print(f"   ❌ Error fetching bank data: {e}")
    bank_txns = []

# =============================================================================
# STEP 3: Pull Ramp Transactions
# =============================================================================
print("\n\n3️⃣ Fetching Ramp Transaction Data...")
print("-" * 80)

try:
    ramp_response = supabase.table('ramp_transactions').select(
        'id, transaction_date, merchant_name, amount, category, memo, card_holder'
    ).order('transaction_date', desc=True).limit(500).execute()
    
    ramp_txns = ramp_response.data if ramp_response.data else []
    print(f"   ✅ Fetched {len(ramp_txns)} Ramp transactions (last 500)")
    
    if ramp_txns:
        print("\n   Sample Ramp transactions:")
        for txn in ramp_txns[:10]:
            amt = float(txn.get('amount', 0))
            print(f"      {txn.get('transaction_date', 'N/A')[:10]} | {txn.get('merchant_name', 'Unknown')[:40]:40} | ${amt:>10,.2f} | {txn.get('category', 'Uncategorized')}")
        
        # Analyze recurring expenses
        print("\n   🔁 Analyzing Recurring Expenses from Ramp:")
        ramp_df = pd.DataFrame(ramp_txns)
        if not ramp_df.empty and 'merchant_name' in ramp_df.columns:
            recurring = ramp_df.groupby('merchant_name').agg({
                'amount': ['count', 'sum', 'mean'],
                'category': lambda x: x.mode()[0] if not x.empty else 'Unknown'
            }).reset_index()
            recurring.columns = ['Merchant', 'Transaction_Count', 'Total_Spent', 'Avg_Amount', 'Category']
            recurring = recurring[recurring['Transaction_Count'] >= 3].sort_values('Total_Spent', ascending=False)
            
            print(f"\n   Top 10 Recurring Vendors (3+ transactions):")
            for idx, row in recurring.head(10).iterrows():
                print(f"      {row['Merchant'][:40]:40} | {int(row['Transaction_Count']):2} txns | ${row['Total_Spent']:>10,.2f} | {row['Category']}")

except Exception as e:
    print(f"   ❌ Error fetching Ramp data: {e}")
    ramp_txns = []

# =============================================================================
# STEP 4: Pull QuickBooks Expense Data
# =============================================================================
print("\n\n4️⃣ Fetching QuickBooks Expenses...")
print("-" * 80)

try:
    qb_expenses_response = supabase.table('quickbooks_expenses').select(
        'id, txn_date, payee, total_amt, payment_type, memo'
    ).order('txn_date', desc=True).limit(500).execute()
    
    qb_expenses = qb_expenses_response.data if qb_expenses_response.data else []
    print(f"   ✅ Fetched {len(qb_expenses)} QuickBooks expenses (last 500)")
    
    if qb_expenses:
        print("\n   Sample QB expenses:")
        for exp in qb_expenses[:10]:
            amt = float(exp.get('total_amt', 0))
            print(f"      {exp.get('txn_date', 'N/A')[:10]} | {exp.get('payee', 'Unknown')[:40]:40} | ${amt:>10,.2f} | {exp.get('payment_type', 'N/A')}")

except Exception as e:
    print(f"   ❌ Error fetching QB expenses: {e}")
    qb_expenses = []

# =============================================================================
# STEP 5: Categorize Expenses into New Structure
# =============================================================================
print("\n\n5️⃣ Categorizing Expenses into Professional Structure...")
print("-" * 80)

# Category mapping rules
CATEGORY_RULES = {
    # Labor - Operations
    'warehouse': 'Operations - Warehouse',
    'fulfillment': 'Operations - Warehouse',
    'customer support': 'Operations - Support',
    'customer care': 'Operations - Support',
    'facility': 'Operations - Facility',
    'maintenance': 'Operations - Facility',
    
    # Labor - G&A
    'controller': 'G&A - Finance',
    'accounting': 'G&A - Finance',
    'finance': 'G&A - Finance',
    'sales': 'G&A - Sales',
    'commission': 'G&A - Sales',
    'executive': 'G&A - Executive',
    'ceo': 'G&A - Executive',
    'hr': 'G&A - HR/Admin',
    'admin': 'G&A - HR/Admin',
    
    # Labor - R&D
    'engineering': 'R&D - Engineering',
    'engineer': 'R&D - Engineering',
    'firmware': 'R&D - Engineering',
    'software': 'R&D - Engineering',
    'product manager': 'R&D - Product',
    'product management': 'R&D - Product',
    'cto': 'R&D - Product',
    'testing': 'R&D - Testing',
    'qa': 'R&D - Testing',
    'certification': 'R&D - Testing',
    
    # Labor - Marketing
    'marketing': 'Marketing - Ops',
    'seo': 'Marketing - Digital',
    'google ads': 'Marketing - Digital',
    'facebook ads': 'Marketing - Digital',
    'amazon ads': 'Marketing - Digital',
    'design': 'Marketing - Creative',
    'creative': 'Marketing - Creative',
    
    # OpEx
    'aws': 'OpEx - IT/Software',
    'amazon web services': 'OpEx - IT/Software',
    'software': 'OpEx - IT/Software',
    'saas': 'OpEx - IT/Software',
    'subscription': 'OpEx - IT/Software',
    'rent': 'OpEx - Rent/Facilities',
    'lease': 'OpEx - Rent/Facilities',
    'insurance': 'OpEx - Insurance',
    'legal': 'OpEx - Professional Services',
    'attorney': 'OpEx - Professional Services',
    'lawyer': 'OpEx - Professional Services',
    'shipping': 'Inventory - Freight',
    'freight': 'Inventory - Freight',
    'fedex': 'Inventory - Freight',
    'ups': 'Inventory - Freight',
}

def categorize_transaction(description, vendor, category_hint=None):
    """
    Categorize a transaction based on description, vendor, and hints
    """
    desc_lower = (description or '').lower()
    vendor_lower = (vendor or '').lower()
    hint_lower = (category_hint or '').lower()
    
    search_text = f"{desc_lower} {vendor_lower} {hint_lower}"
    
    for keyword, category in CATEGORY_RULES.items():
        if keyword in search_text:
            return category
    
    return 'Uncategorized'

# Categorize all transactions
print("\n   Categorizing transactions...")

categorized_data = []

# Process labor bills
for bill in labor_bills:
    cat = categorize_transaction(
        bill.get('vendor_ref', ''),
        bill.get('vendor_ref', ''),
        bill.get('override_account_type', '')
    )
    categorized_data.append({
        'Source': 'QuickBooks Bill',
        'Date': bill.get('bill_date', bill.get('txn_date', '')),
        'Vendor/Payee': bill.get('vendor_ref', 'Unknown'),
        'Amount': float(bill.get('total_amt', 0)),
        'Category': cat,
        'Subcategory': bill.get('override_account_type', ''),
        'Type': 'Labor' if 'labor' in bill.get('override_category', '').lower() else 'OpEx'
    })

# Process bank transactions (filter for expenses only)
for txn in bank_txns:
    amt = float(txn.get('amount', 0))
    if amt < 0:  # Expenses are negative
        cat = categorize_transaction(
            txn.get('description', ''),
            txn.get('description', ''),
            txn.get('category', '')
        )
        categorized_data.append({
            'Source': 'Bank Statement',
            'Date': txn.get('transaction_date', ''),
            'Vendor/Payee': txn.get('description', 'Unknown'),
            'Amount': abs(amt),
            'Category': cat,
            'Subcategory': txn.get('category', ''),
            'Type': 'OpEx'
        })

# Process Ramp transactions
for txn in ramp_txns:
    amt = float(txn.get('amount', 0))
    cat = categorize_transaction(
        txn.get('merchant_name', ''),
        txn.get('merchant_name', ''),
        txn.get('category', '')
    )
    categorized_data.append({
        'Source': 'Ramp',
        'Date': txn.get('transaction_date', ''),
        'Vendor/Payee': txn.get('merchant_name', 'Unknown'),
        'Amount': abs(amt),
        'Category': cat,
        'Subcategory': txn.get('category', ''),
        'Type': 'OpEx',
        'Card_Holder': txn.get('card_holder', '')
    })

# Process QB expenses
for exp in qb_expenses:
    amt = float(exp.get('total_amt', 0))
    cat = categorize_transaction(
        exp.get('payee', ''),
        exp.get('payee', ''),
        exp.get('memo', '')
    )
    categorized_data.append({
        'Source': 'QuickBooks Expense',
        'Date': exp.get('txn_date', ''),
        'Vendor/Payee': exp.get('payee', 'Unknown'),
        'Amount': abs(amt),
        'Category': cat,
        'Subcategory': exp.get('payment_type', ''),
        'Type': 'OpEx'
    })

print(f"   ✅ Categorized {len(categorized_data)} total transactions")

# =============================================================================
# STEP 6: Create DataFrame and Analyze
# =============================================================================
print("\n\n6️⃣ Analyzing Categorized Data...")
print("-" * 80)

df = pd.DataFrame(categorized_data)

if not df.empty:
    # Convert date to datetime
    df['Date'] = pd.to_datetime(df['Date'], errors='coerce')
    
    # Summary by category
    print("\n   💰 SPENDING BY CATEGORY:")
    category_summary = df.groupby('Category')['Amount'].agg(['count', 'sum']).sort_values('sum', ascending=False)
    category_summary.columns = ['Transaction_Count', 'Total_Amount']
    
    for idx, row in category_summary.iterrows():
        print(f"      {idx:40} | {int(row['Transaction_Count']):4} txns | ${row['Total_Amount']:>12,.2f}")
    
    # Summary by type
    print("\n   📊 SPENDING BY TYPE:")
    type_summary = df.groupby('Type')['Amount'].sum().sort_values(ascending=False)
    for type_name, amount in type_summary.items():
        print(f"      {type_name:20} | ${amount:>12,.2f}")
    
    # Top vendors
    print("\n   🏢 TOP 20 VENDORS BY SPEND:")
    vendor_summary = df.groupby('Vendor/Payee')['Amount'].sum().sort_values(ascending=False).head(20)
    for vendor, amount in vendor_summary.items():
        print(f"      {vendor[:50]:50} | ${amount:>12,.2f}")

# =============================================================================
# STEP 7: Export to Excel
# =============================================================================
print("\n\n7️⃣ Exporting to Excel...")
print("-" * 80)

if not df.empty:
    output_file = "BDI_Cash_Forecast_Real_Data_v1.xlsx"
    
    with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
        # Sheet 1: All Transactions
        df.to_excel(writer, sheet_name='All Transactions', index=False)
        
        # Sheet 2: Labor Spend Summary
        labor_df = df[df['Type'] == 'Labor'].copy()
        if not labor_df.empty:
            labor_summary = labor_df.pivot_table(
                index='Vendor/Payee',
                columns=df['Date'].dt.to_period('W').astype(str),
                values='Amount',
                aggfunc='sum',
                fill_value=0
            )
            labor_summary.to_excel(writer, sheet_name='Labor Spend')
        
        # Sheet 3: OpEx Summary
        opex_df = df[df['Type'] == 'OpEx'].copy()
        if not opex_df.empty:
            opex_summary = opex_df.pivot_table(
                index='Category',
                columns=df['Date'].dt.to_period('W').astype(str),
                values='Amount',
                aggfunc='sum',
                fill_value=0
            )
            opex_summary.to_excel(writer, sheet_name='OpEx by Category')
        
        # Sheet 4: Category Summary
        category_summary.to_excel(writer, sheet_name='Category Summary')
    
    print(f"   ✅ Excel file created: {output_file}")
    print(f"   📊 Contains {len(df)} transactions across {len(df['Category'].unique())} categories")
else:
    print("   ⚠️  No data to export")

print("\n" + "=" * 80)
print("✅ ANALYSIS COMPLETE!")
print("=" * 80)
print("\nNext Steps:")
print("1. Review the Excel file to validate categorizations")
print("2. Identify any 'Uncategorized' items and assign proper categories")
print("3. Merge this with the Cash Forecast template")
print("4. Iterate on categorization rules based on your feedback")

