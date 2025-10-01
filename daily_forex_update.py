def upload_to_supabase():
    """Upload new CSV files to Supabase"""
    os.chdir('/Users/rossj/Desktop/dukascopy')
    csv_files = glob.glob('download/*.csv')
    
    yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y%m%d')
    uploaded_count = 0
    
    for csv_file in csv_files:
        # Check if file starts with yesterday's date after the pair name
        # Format: gbpusd-m1-bid-20250930-20251001.csv
        if f"-{yesterday}-" not in csv_file:
            continue
            
        print(f"\nProcessing {csv_file}...")
        
        # Parse filename to get pair
        filename = os.path.basename(csv_file)
        parts = filename.split('-')
        pair = parts[0].upper()
        
        # Read CSV
        df = pd.read_csv(csv_file)
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
        df['pair'] = pair
        
        # Get the actual date from the data, not the filename
        actual_date = df['timestamp'].dt.date.iloc[0]
        print(f"  Data date: {actual_date}")
        
        # Check if this specific date's data already exists
        check_date = actual_date.strftime('%Y-%m-%d')
        existing = supabase.table('forex_prices').select('count').eq('pair', pair).gte('timestamp', f"{check_date} 00:00:00").lte('timestamp', f"{check_date} 23:59:59").execute()
        
        if existing.data and len(existing.data) > 0 and existing.data[0]['count'] > 0:
            print(f"  ⚠️  Data already exists for {pair} on {check_date}. Skipping...")
            # Delete the file since we don't need it
            os.remove(csv_file)
            continue
        
        # Prepare and upload data
        df['timestamp'] = df['timestamp'].dt.strftime('%Y-%m-%d %H:%M:%S')
        data_to_upload = df[['pair', 'timestamp', 'open', 'high', 'low', 'close']].to_dict('records')
        
        # Upload in batches
        batch_size = 1000
        for i in range(0, len(data_to_upload), batch_size):
            batch = data_to_upload[i:i+batch_size]
            try:
                supabase.table('forex_prices').insert(batch).execute()
            except Exception as e:
                print(f"  ✗ Error uploading batch: {e}")
                return False
        
        print(f"  ✓ Uploaded {len(data_to_upload)} rows for {pair}")
        uploaded_count += 1
        
        # Clean up - delete the processed CSV
        os.remove(csv_file)
    
    print(f"\nTotal files uploaded: {uploaded_count}")
    return uploaded_count > 0
