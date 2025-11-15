#!/usr/bin/env python3
"""
Build Cash Forecast - Iteration 1
Pull REAL data from BOSS to populate Labor & OpEx tabs
"""

import os
import pandas as pd
from supabase import create_client, Client
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: Missing Supabase credentials")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("=" * 80)
print("💰 BUILDING CASH FORECAST FROM REAL BOSS DATA - ITERATION 1")
print("=" * 80)

all_expenses = []

# =============================================================================
# 1. Pull QuickBooks Bills (Vendor Bills)
# =============================================================================
print("\n1️⃣ Fetching QuickBooks Bills...")
try:
    bills_response = supabase.table('quickbooks_bills').select('*').execute()
    bills = bills_response.data if bills_response.data else []
    print(f"   ✅ Found {len(bills)} bills")
    
    # Get GL overrides
    overrides_response = supabase.table('gl_transaction_overrides').select('*').execute()
    overrides = overrides_response.data if overrides_response.data else []
    override_map = {o['transaction_id']: o for o in overrides}
    print(f"   ✅ Found {len(overrides)} GL overrides")
    
    for bill in bills:
        override = override_map.get(str(bill['id']))
        all_expenses.append({
            'Source': 'QB Bill',
            'Date': bill.get('bill_date'),
            'Vendor': bill.get('vendor_name', 'Unknown'),
            'Amount': abs(float(bill.get('total_amount', 0))),
            'Category': override.get('override_category', 'Uncategorized') if override else 'Uncategorized',
            'Subcategory': override.get('override_account_type', '') if override else '',
            'Balance': float(bill.get('balance', 0))
        })
except Exception as e:
    print(f"   ❌ Error: {e}")

# =============================================================================
# 2. Pull QuickBooks Expenses
# =============================================================================
print("\n2️⃣ Fetching QuickBooks Expenses...")
try:
    expenses_response = supabase.table('quickbooks_expenses').select('*').execute()
    expenses = expenses_response.data if expenses_response.data else []
    print(f"   ✅ Found {len(expenses)} expenses")
    
    for exp in expenses:
        all_expenses.append({
            'Source': 'QB Expense',
            'Date': exp.get('expense_date'),
            'Vendor': exp.get('payee', 'Unknown'),
            'Amount': abs(float(exp.get('total_amt', 0))),
            'Category': 'Uncategorized',
            'Subcategory': exp.get('payment_type', ''),
            'Balance': 0
        })
except Exception as e:
    print(f"   ❌ Error: {e}")

# =============================================================================
# 3. Pull Bank Statements
# =============================================================================
print("\n3️⃣ Fetching Bank Transactions...")
try:
    bank_response = supabase.table('bank_statements').select('*').limit(1000).execute()
    bank_txns = bank_response.data if bank_response.data else []
    print(f"   ✅ Found {len(bank_txns)} bank transactions")
    
    for txn in bank_txns:
        amt = float(txn.get('amount', 0))
        if amt < 0:  # Expenses only
            all_expenses.append({
                'Source': 'Bank',
                'Date': txn.get('transaction_date'),
                'Vendor': txn.get('description', 'Unknown'),
                'Amount': abs(amt),
                'Category': txn.get('category', 'Uncategorized'),
                'Subcategory': '',
                'Balance': 0
            })
except Exception as e:
    print(f"   ❌ Error: {e}")

# =============================================================================
# 4. Pull Ramp Transactions
# =============================================================================
print("\n4️⃣ Fetching Ramp Transactions...")
try:
    ramp_response = supabase.table('ramp_transactions').select('*').limit(1000).execute()
    ramp_txns = ramp_response.data if ramp_response.data else []
    print(f"   ✅ Found {len(ramp_txns)} Ramp transactions")
    
    for txn in ramp_txns:
        # Get actual column names from first transaction
        if ramp_txns and len(ramp_txns) > 0:
            print(f"\n   Sample Ramp columns: {list(ramp_txns[0].keys())[:10]}")
        
        all_expenses.append({
            'Source': 'Ramp',
            'Date': txn.get('transaction_date') or txn.get('date'),
            'Vendor': txn.get('merchant_name') or txn.get('merchant') or txn.get('description', 'Unknown'),
            'Amount': abs(float(txn.get('amount', 0))),
            'Category': txn.get('category', 'Uncategorized'),
            'Subcategory': txn.get('card_holder', ''),
            'Balance': 0
        })
except Exception as e:
    print(f"   ❌ Error: {e}")

# =============================================================================
# 5. Analyze & Export
# =============================================================================
print(f"\n5️⃣ Analyzing {len(all_expenses)} total transactions...")

if all_expenses:
    df = pd.DataFrame(all_expenses)
    df['Date'] = pd.to_datetime(df['Date'], errors='coerce')
    df = df.sort_values('Date', ascending=False)
    
    # Summary
    print("\n   💰 BY SOURCE:")
    print(df.groupby('Source')['Amount'].agg(['count', 'sum']))
    
    print("\n   📊 BY CATEGORY:")
    cat_summary = df.groupby('Category')['Amount'].agg(['count', 'sum']).sort_values('sum', ascending=False)
    print(cat_summary)
    
    print("\n   🏢 TOP 20 VENDORS:")
    vendor_summary = df.groupby('Vendor')['Amount'].sum().sort_values(ascending=False).head(20)
    for vendor, amt in vendor_summary.items():
        print(f"      {vendor[:50]:50} ${amt:>12,.2f}")
    
    # Export
    output_file = "BDI_Cash_Forecast_Real_Data_v2.xlsx"
    with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='All Expenses', index=False)
        cat_summary.to_excel(writer, sheet_name='By Category')
        vendor_summary.to_frame('Total').to_excel(writer, sheet_name='Top Vendors')
    
    print(f"\n   ✅ Excel created: {output_file}")
else:
    print("   ⚠️  No data found")

print("\n" + "=" * 80)
print("✅ DONE! Review the Excel file.")
print("=" * 80)

