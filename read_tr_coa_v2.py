#!/usr/bin/env python3
"""
Read TR COA Mapping baseline file - try all sheets
"""

import pandas as pd
import json

input_file = "/Users/Steve/Projects/BDI/BDI PORTAL/TB TR COA Mapping baseline.xlsx"

print("=" * 80)
print("READING TR COA MAPPING FILE - ALL SHEETS")
print("=" * 80)
print()

try:
    # First, get all sheet names
    xl_file = pd.ExcelFile(input_file)
    print(f"✓ Found {len(xl_file.sheet_names)} sheets:")
    for i, sheet_name in enumerate(xl_file.sheet_names):
        print(f"  Sheet {i+1}: {sheet_name}")
    print()
    
    # Read each sheet
    for sheet_name in xl_file.sheet_names:
        print("=" * 80)
        print(f"SHEET: {sheet_name}")
        print("=" * 80)
        
        df = pd.read_excel(input_file, sheet_name=sheet_name, header=None)
        print(f"Dimensions: {df.shape[0]} rows x {df.shape[1]} columns")
        print()
        
        print("First 40 rows:")
        print(df.head(40).to_string())
        print()
        print()
    
    # Try reading the first sheet with different header rows
    print("=" * 80)
    print("TRYING DIFFERENT HEADER ROWS (Sheet 0):")
    print("=" * 80)
    
    for header_row in [0, 1, 2, 3, 4, 5]:
        try:
            df = pd.read_excel(input_file, sheet_name=0, header=header_row)
            print(f"\n--- Header at row {header_row} ---")
            print(f"Columns: {list(df.columns)}")
            print(f"First 5 data rows:")
            print(df.head(5).to_string())
        except Exception as e:
            print(f"Header row {header_row} failed: {e}")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

