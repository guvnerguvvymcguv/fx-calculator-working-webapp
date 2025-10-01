#!/usr/bin/env python3
import os
import subprocess
import pandas as pd
from datetime import datetime, timedelta
from supabase import create_client, Client
import glob
import sys

# Supabase credentials
SUPABASE_URL = "https://wvzqxwvlozzbmdrqyify.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2enF4d3Zsb3p6Ym1kcnF5aWZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MTgxMjQsImV4cCI6MjA3MjM5NDEyNH0.xWmR6pPUQb3QeVV-XNJlDNmH9XLXCSlLNry7yswPA3k"  # Replace with your actual key

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Currency pairs to update
PAIRS = ['eurusd', 'gbpusd', 'eurgbp', 'gbpaud', 'gbpnok', 'gbpsek']

def download_yesterday_data():
    """Download yesterday's forex data"""
    yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
    today = datetime.now().strftime('%Y-%m-%d')
    
    print(f"Downloading data for {yesterday}")
    
    for pair in PAIRS:
        print(f"Downloading {pair.upper()}...")
        cmd = f"npx dukascopy-node -i {pair} -from {yesterday} -to {today} -t m1 -f csv"
        
        try:
            subprocess.run(cmd, shell=True, check=True, cwd='/Users/rossj/Desktop/dukascopy')
            print(f"✓ {pair.upper()} downloaded successfully")
        except subprocess.CalledProcessError as e:
            print(f"✗ Error downloading {pair.upper()}: {e}")
            return False
    
    return True

def upload_to_supabase():
    """Upload new CSV files to Supabase"""
    os.chdir('/Users/rossj/Desktop/dukascopy')
    csv_files = glob.glob('download/*.csv')
    
    yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
    uploaded_count = 0
    
    print(f"\nFound {len(csv_files)} CSV files to process")
    
    for csv_file in csv_files:
        # Check if file contains yesterday's date in the format -YYYYMMDD-
        if f"-{yesterday}-" not in csv_file and yesterday not in csv_file:
            print(f"Skipping {csv_file} - not from yesterday")
            continue
            
        print(f"\nProcessing {csv_file}...")
        
        # Parse filename to get pair
        filename = os.path.basename(csv_file)
        # Handle both formats: gbpusd-m1-bid-20250930-20251001.csv or gbpusdm1bid2025093020251001.csv
        if '-' in filename:
            parts = filename.split('-')
            pair = parts[0].upper()
        else:
            # Extract first 6 characters for pair name
            pair = filename[:6].upper()
            # Handle EURGBP which is 6 characters
            if not pair.startswith('EUR') and not pair.startswith('GBP') and not pair.startswith('USD'):
                pair = filename[:7].upper()
        
        # Read CSV
        df = pd.read_csv(csv_file)
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
        df['pair'] = pair
        
        # Get the actual date from the data, not the filename
        actual_date = df['timestamp'].dt.date.iloc[0]
        print(f"  Data date: {actual_date}")
        print(f"  Pair: {pair}")
        print(f"  Rows in file: {len(df)}")
        
        # Check if this specific date's data already exists
        check_date = actual_date.strftime('%Y-%m-%d')
        existing = supabase.table('forex_prices').select('count').eq('pair', pair).gte('timestamp', f"{check_date} 00:00:00").lte('timestamp', f"{check_date} 23:59:59").execute()
        
        if existing.data and len(existing.data) > 0 and existing.data[0].get('count', 0) > 0:
            print(f"  ⚠️  Data already exists for {pair} on {check_date}. Skipping...")
            # Delete the file since we don't need it
            os.remove(csv_file)
            continue
        
        # Prepare and upload data
        df['timestamp'] = df['timestamp'].dt.strftime('%Y-%m-%d %H:%M:%S')
        data_to_upload = df[['pair', 'timestamp', 'open', 'high', 'low', 'close']].to_dict('records')
        
        # Upload in batches
        batch_size = 1000
        total_uploaded = 0
        for i in range(0, len(data_to_upload), batch_size):
            batch = data_to_upload[i:i+batch_size]
            try:
                result = supabase.table('forex_prices').insert(batch).execute()
                total_uploaded += len(batch)
                print(f"  ✓ Uploaded batch {i//batch_size + 1} ({len(batch)} rows)")
            except Exception as e:
                print(f"  ✗ Error uploading batch: {e}")
                return False
        
        print(f"  ✓ Successfully uploaded {total_uploaded} rows for {pair}")
        uploaded_count += 1
        
        # Clean up - delete the processed CSV
        os.remove(csv_file)
        print(f"  ✓ Cleaned up CSV file")
    
    print(f"\nTotal files uploaded: {uploaded_count}")
    return uploaded_count > 0

def main():
    """Main execution function"""
    print(f"\n{'='*50}")
    print(f"Forex Daily Update - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*50}\n")
    
    # Download yesterday's data
    if not download_yesterday_data():
        print("Failed to download data. Exiting.")
        sys.exit(1)
    
    # Upload to Supabase
    print("\nUploading to Supabase...")
    if upload_to_supabase():
        print("\n✅ Daily update completed successfully!")
    else:
        print("\n⚠️  No new data uploaded (might already exist)")

if __name__ == "__main__":
    main()