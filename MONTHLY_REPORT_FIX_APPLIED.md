# ✅ MONTHLY REPORT FIX APPLIED

## Changes Made

**File**: `src/components/AdminDashboard.tsx`
**Function**: `handleTestReport` (around line 806)

### What Was Fixed

The test button was calling the edge function **without** passing `company_id`, causing it to run in PRODUCTION mode and query the wrong date range (previous calendar month = September) instead of TEST mode (last 30 days = includes October).

### The Fix

**BEFORE (Broken)**:
```typescript
const response = await supabase.functions.invoke('generate-monthly-report', {
  headers: {
    Authorization: `Bearer ${session?.access_token}`
  }
  // ❌ No company_id = PRODUCTION mode = September data
});
```

**AFTER (Fixed)**:
```typescript
const response = await supabase.functions.invoke('generate-monthly-report', {
  body: {
    company_id: profile.company_id  // ✅ Triggers TEST mode = last 30 days
  },
  headers: {
    Authorization: `Bearer ${session?.access_token}`
  }
});
```

### Additional Improvements

1. ✅ Better error handling with user-friendly messages
2. ✅ Console logging for debugging
3. ✅ Updated confirmation dialog text to clarify it uses "LAST 30 DAYS"
4. ✅ Properly handles authentication and profile checks

## Next Steps

### 1. Commit & Push

Run these commands in your terminal:

```bash
cd /Users/rossj/Desktop/broker-pitch-calc/fx-calculator-working-webapp

git add src/components/AdminDashboard.tsx

git commit -m "Fix: Monthly report test button now uses last 30 days (TEST mode)

- Pass company_id to edge function to trigger TEST mode
- TEST mode queries last 30 days instead of previous calendar month
- Add better error handling and user feedback
- Update confirmation dialog to clarify date range
- Add console logging for debugging"

git push origin main
```

### 2. Wait for Vercel Deployment

Vercel will automatically deploy your changes in 1-2 minutes.

### 3. Test the Fix

Once deployed:

1. Go to https://spreadchecker.co.uk/admin
2. Scroll to "Monthly Client Reports" section
3. Click "Send Test Report" button
4. Check the Supabase logs - you should now see:
   ```
   🧪 TEST MODE: Using LAST 30 DAYS data
   Date range: 2025-09-23T00:00:00.000Z to 2025-10-23T23:59:59.999Z
   Found 96 calculations ✅
   ```
5. Check your email for the PDF report

## Expected Results

**Supabase Edge Function Logs Should Show**:
```
🚀 Starting monthly client report generation...
Request body: { company_id: "your-company-id" }
Test company ID: your-company-id
🧪 TEST MODE: Using LAST 30 DAYS data
Date range: 2025-09-23T00:00:00.000Z to 2025-10-23T23:59:59.999Z
📊 Fetching calculations for company: your-company-id
Found junior users: [count]
Calculations query result: 96 records found
Grouped into [X] unique clients
Found [X] clients with [96] total calculations
Generating PDF...
✅ PDF generated successfully, size: [bytes] bytes
Sending to [Y] admins...
✅ Email sent to admin@example.com
✅ Monthly report generation complete!
```

**In Your Email**:
- Subject: "Spread Checker - Client Data Report (Last 30 Days...)"
- PDF attachment with all 96 calculations
- Summary showing correct metrics

## Troubleshooting

If you still see issues:

1. **Check the logs carefully** - look for any errors
2. **Verify these settings** in Supabase companies table:
   - `client_data_enabled` = true
   - `monthly_reports_enabled` = true
3. **Check Resend API** - make sure RESEND_API_KEY is set in Supabase environment variables
4. **Look in spam folder** - first emails from new domain might be flagged

## What This Fix Does

✅ **Solves the date range mismatch**:
- Before: Queried September 2025 (found 0 calculations)
- After: Queries last 30 days = Sept 23 - Oct 23, 2025 (finds all 96 calculations)

✅ **Enables proper testing**:
- Test mode uses recent data you actually have
- Production mode (scheduled for 1st of month) uses previous full month

✅ **Improves user experience**:
- Clear confirmation message
- Better error messages
- Console logging for debugging
