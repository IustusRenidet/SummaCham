import pandas as pd
import sys
import os

def read_excel(file_path):
    try:
        xls = pd.ExcelFile(file_path)
        print(f"File: {file_path}")
        print(f"Sheet names: {xls.sheet_names}")
        for sheet_name in xls.sheet_names:
            print(f"\n--- Sheet: {sheet_name} ---")
            df = pd.read_excel(xls, sheet_name=sheet_name, nrows=5)
            print(df.to_string())
            print("\nColumns:", df.columns.tolist())
    except Exception as e:
        print(f"Error reading {file_path}: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        read_excel(sys.argv[1])
    else:
        print("Please provide a file path.")
