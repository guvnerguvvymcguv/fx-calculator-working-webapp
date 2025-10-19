# Companies House Data Import

This script imports the Companies House bulk dataset into Supabase.

## Prerequisites

1. Download the latest data from: http://download.companieshouse.gov.uk/en_output.html
2. Unzip the file to your Desktop (or note the path)
3. Ensure your `.env.local` has:
   - `VITE_SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`

## Installation

```bash
npm install --save-dev tsx
```

## Running the Import

```bash
# If CSV is on your Desktop
npm run import-companies

# Or specify custom path
npm run import-companies ~/path/to/BasicCompanyDataAsOneFile-2025-10-01.csv
```

## What Gets Imported

✅ **Included:**
- Active companies only
- Companies with valid SIC codes
- Operating businesses (not dormant/holding companies)

❌ **Excluded:**
- Inactive/dissolved companies
- Dormant companies (SIC 99999)
- Holding companies (SIC 70100, 64200)
- Companies with no SIC codes

## Expected Results

- **Original dataset:** ~5 million companies
- **After filtering:** ~2-3 million companies
- **Import time:** ~1-1.5 hours
- **Database size:** ~3GB

## Progress

The script shows real-time progress:
```
📊 Progress: 50,000 rows processed | 25,000 imported | 500/s
📊 Progress: 100,000 rows processed | 50,000 imported | 520/s
...
```

## Final Stats

After completion, you'll see:
```
✅ Import complete!

📈 Statistics:
   Total rows processed: 5,234,567
   Valid companies found: 2,456,789
   Successfully imported: 2,456,789
   Skipped (inactive): 1,234,567
   Skipped (dormant): 456,789
   Skipped (no SIC): 123,456
   Skipped (invalid SIC): 234,567
   Errors: 0
   Time taken: 87.3 minutes

🎉 Done! 2,456,789 companies now in Supabase.
```

## Troubleshooting

**Error: "Missing environment variables"**
- Add `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_KEY` to `.env.local`

**Error: "CSV file not found"**
- Check the file path
- Ensure you've unzipped the download

**Slow performance:**
- Normal! Processing 5M rows takes time
- Imports ~500-1000 rows/second
- Check your internet connection (uploading to Supabase)
