#!/usr/bin/env python3
"""
Read TR COA Mapping baseline file and analyze structure
"""

import pandas as pd
import json

input_file = "/Users/Steve/Projects/BDI/BDI PORTAL/TB TR COA Mapping baseline.xlsx"

print("=" * 80)
print("READING TR COA MAPPING FILE")
print("=" * 80)
print()

try:
    # Try reading with different parameters
    df = pd.read_excel(input_file, sheet_name=0)
    print(f"✓ Successfully loaded Excel file")
    print(f"✓ Total rows: {df.shape[0]}")
    print(f"✓ Total columns: {df.shape[1]}")
    print()
    
    print("=" * 80)
    print("COLUMN NAMES:")
    print("=" * 80)
    for i, col in enumerate(df.columns):
        print(f"  Column {i}: {col}")
    print()
    
    print("=" * 80)
    print("FIRST 30 ROWS:")
    print("=" * 80)
    print(df.head(30).to_string())
    print()
    
    print("=" * 80)
    print("DATA TYPES:")
    print("=" * 80)
    print(df.dtypes)
    print()
    
    # Try to identify TR GL Code column
    print("=" * 80)
    print("LOOKING FOR TR GL CODE COLUMN:")
    print("=" * 80)
    for col in df.columns:
        if 'TR' in str(col).upper() or 'GL' in str(col).upper():
            print(f"\nFound potential TR GL column: {col}")
            print(f"Sample values:")
            print(df[col].dropna().head(20).to_list())
    
    # Export to JSON for analysis
    output_json = "/Users/Steve/Projects/BDI/BDI PORTAL/TR_COA_Analysis.json"
    
    # Convert DataFrame to dict
    data_dict = {
        'columns': list(df.columns),
        'row_count': len(df),
        'sample_data': df.head(50).to_dict(orient='records')
    }
    
    with open(output_json, 'w') as f:
        json.dump(data_dict, f, indent=2, default=str)
    
    print()
    print("=" * 80)
    print(f"✓ Exported analysis to: {output_json}")
    print("=" * 80)
    
except Exception as e:
    print(f"❌ Error reading Excel file: {e}")
    import traceback
    traceback.print_exc()

