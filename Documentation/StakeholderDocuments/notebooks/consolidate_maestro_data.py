import pandas as pd
import os
from pathlib import Path
import re

def consolidate_maestro_data():
    """
    Consolidate all Maestro engagement data files from monthly Excel files
    into a single dataset.
    """
    # Define the source directory
    source_dir = Path('./raw/maestro/Maestro Engagement Data')

    # List to store all dataframes
    all_data = []

    # Get all Excel files in the directory
    excel_files = sorted(source_dir.glob('*.xlsx'))

    print(f"Found {len(excel_files)} Excel files to process")

    for file_path in excel_files:
        print(f"Processing: {file_path.name}")

        # Extract month and year from filename
        # Format: 1061_Maestro Engagement Data_Month_Year.xlsx
        match = re.search(r'_([A-Za-z]+)_(\d{4})\.xlsx', file_path.name)
        if match:
            month_name = match.group(1)
            year = match.group(2)

            # Read the Excel file
            df = pd.read_excel(file_path)

            # Add month and year columns
            df['Month'] = month_name
            df['Year'] = int(year)

            # Create a date column for easier sorting/filtering
            month_map = {
                'Jan': 1, 'Feb': 2, 'March': 3, 'April': 4, 'May': 5, 'June': 6,
                'July': 7, 'August': 8, 'Sept': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
            }
            month_num = month_map.get(month_name, 1)
            df['Date'] = pd.to_datetime(f"{year}-{month_num:02d}-01")

            all_data.append(df)
            print(f"  - Loaded {len(df)} rows")

    # Concatenate all dataframes
    consolidated_df = pd.concat(all_data, ignore_index=True)

    # Sort by date, client, and engagement
    consolidated_df = consolidated_df.sort_values(['Date', 'Client Id', 'Engagement Id'])

    print(f"\nTotal consolidated rows: {len(consolidated_df)}")
    print(f"Date range: {consolidated_df['Date'].min()} to {consolidated_df['Date'].max()}")
    print(f"Unique clients: {consolidated_df['Client Id'].nunique()}")
    print(f"Unique engagements: {consolidated_df['Engagement Id'].nunique()}")

    # Save to CSV and Excel
    output_csv = './raw/maestro/maestro_engagement_data_consolidated.csv'
    output_excel = './raw/maestro/maestro_engagement_data_consolidated.xlsx'

    consolidated_df.to_csv(output_csv, index=False)
    print(f"\nSaved consolidated data to: {output_csv}")

    consolidated_df.to_excel(output_excel, index=False)
    print(f"Saved consolidated data to: {output_excel}")

    # Display summary statistics
    print("\n=== Summary Statistics ===")
    print(f"\nRecords per year:")
    print(consolidated_df.groupby('Year').size())
    print(f"\nAverage utilization %: {consolidated_df['Product Engagement Utilization %'].mean():.2f}%")
    print(f"Min utilization %: {consolidated_df['Product Engagement Utilization %'].min()}%")
    print(f"Max utilization %: {consolidated_df['Product Engagement Utilization %'].max()}%")

    return consolidated_df

if __name__ == '__main__':
    df = consolidate_maestro_data()
