# Monthly Report Issue - Complete Diagnosis & Solution

## 📊 Issue Summary
- **Problem**: Test monthly reports showing 0 calculations and not sending emails
- **Root Cause**: Date range mismatch - function querying September when calculations are in October
- **Impact**: Cannot test or verify monthly report functionality

## 🔍 Detailed Diagnosis

### What's Happening
Looking at your Supabase logs from the screenshot:

```
Query range: 2025-09-01T00:00:00.000Z to 2025-09-30T23:59:59.999Z
Most recent calculation: 2025-10-23T07:28:09.034514+00:00
```

**The Problem**:
1. Your calculations were done in **October 2025** (you mentioned 96 calcs this month)
2. The function is querying **September 2025** (2025-09-01 to 2025-09-30)
3. Result: 0 calculations found → no PDF generated → no email sent

### Why This Happens

The `generate-monthly-report` edge function has two modes:

**PRODUCTION MODE** (default):
- Triggered when: NO `company_id` in request body
- Date range: Previous calendar month (e.g., if today is Oct 23, queries all of September)
- Purpose: Scheduled monthly reports on the 1st of each month

**TEST MODE** (for testing):
- Triggered when: `company_id` IS in request body
- Date range: Last 30 days from today (e.g., if today is Oct 23, queries Sept 23 - Oct 23)
- Purpose: Manual testing with recent data

### The Bug
In `AdminDashboard.tsx`, the "Send Test Report" button does NOT pass `company_id`, so it runs in PRODUCTION mode:

```typescript
// CURRENT (BROKEN) CODE:
const response = await supabase.functions.invoke('generate-monthly-report', {
  headers: {
    Authorization: `Bearer ${session?.access_token}`
  }
  // ❌ No body with company_id = PRODUCTION mode = queries previous month
});
```

## ✅ Solution

### Step 1: Update AdminDashboard.tsx

**File Location**: `src/components/AdminDashboard.tsx`

**Find** (around line 425):
```typescript
const handleTestReport = async () => {
  if (!confirm('This will generate and send a test report for the previous month to all admins. Continue?')) {
    return;
  }
  
  setTestingReport(true);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await supabase.functions.invoke('generate-monthly-report', {
      headers: {
        Authorization: `Bearer ${session?.access_token}`
      }
    });
    
    if (response.error) throw response.error;
    
    alert('Test report sent successfully! Check your email.');
  } catch (error) {
    console.error('Error generating test report:', error);
    alert('Failed to generate test report. Please try again.');
  } finally {
    setTestingReport(false);
  }
};
```

**Replace with**:
```typescript
const handleTestReport = async () => {
  if (!confirm('This will generate and send a test report for the LAST 30 DAYS to all admins. Continue?')) {
    return;
  }
  
  setTestingReport(true);
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Not authenticated');
      return;
    }
    
    // Get company_id from user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();
      
    if (!profile?.company_id) {
      alert('Company not found');
      return;
    }
    
    const { data: { session } } = await supabase.auth.getSession();
    
    console.log('Sending test report request with company_id:', profile.company_id);
    
    // ✅ Pass company_id in body to trigger TEST MODE
    const response = await supabase.functions.invoke('generate-monthly-report', {
      body: {
        company_id: profile.company_id  // THIS IS THE KEY
      },
      headers: {
        Authorization: `Bearer ${session?.access_token}`
      }
    });
    
    console.log('Test report response:', response);
    
    if (response.error) {
      console.error('Test report error:', response.error);
      throw response.error;
    }
    
    alert('Test report sent successfully! Check your email in a few moments.');
  } catch (error) {
    console.error('Error generating test report:', error);
    const errorMsg = error instanceof Error ? error.message : 'Failed to generate test report';
    alert(`Error: ${errorMsg}`);
  } finally {
    setTestingReport(false);
  }
};
```

### Step 2: Deploy Changes

1. **Commit and push to GitHub**:
   ```bash
   git add src/components/AdminDashboard.tsx
   git commit -m "Fix: Monthly report test button now uses last 30 days (TEST mode)"
   git push origin main
   ```

2. **Vercel will auto-deploy** (should take 1-2 minutes)

3. **Verify deployment**:
   - Go to https://spreadchecker.co.uk
   - Check deployment status in Vercel dashboard

### Step 3: Test the Fix

1. **Login as admin** at https://spreadchecker.co.uk/admin

2. **Scroll to "Monthly Client Reports" section**

3. **Click "Send Test Report"** button

4. **Check Supabase logs**:
   - Go to Supabase Dashboard → Edge Functions → generate-monthly-report → Logs
   - You should now see:
     ```
     🧪 TEST MODE: Using LAST 30 DAYS data
     Date range: 2025-09-23T00:00:00.000Z to 2025-10-23T23:59:59.999Z
     Found 96 calculations
     Found [X] active clients for [Company Name]
     ```

5. **Check your email** (all admins should receive the PDF report)

## 🔍 Understanding the Edge Function Logic

The `generate-monthly-report/index.ts` function works like this:

```typescript
// Get request body
const requestBody = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
const testCompanyId = requestBody.company_id;

if (testCompanyId) {
  // ✅ TEST MODE (last 30 days)
  lastDay = new Date(); // Today
  firstDay = new Date();
  firstDay.setDate(firstDay.getDate() - 30); // Go back 30 days
} else {
  // ❌ PRODUCTION MODE (previous calendar month)
  firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1); // Sept 1
  lastDay = new Date(now.getFullYear(), now.getMonth(), 0); // Sept 30
}
```

## 📧 Why Emails Weren't Sending

The edge function has this logic:

```typescript
if (clientData.clients.length === 0) {
  console.log('No activity for company - skipping');
  return; // ❌ EXIT - no email sent
}

// Only reaches here if clients.length > 0
console.log('Generating PDF...');
const pdfBuffer = await generatePDF(...);

console.log('Sending email...');
await sendEmail(...); // ✅ Email sent
```

Since it found 0 calculations (wrong date range), it never generated a PDF or sent an email.

## 🧪 Additional Manual Testing (Optional)

You can also test directly in Supabase Dashboard:

1. Go to: **Supabase Dashboard** → **Edge Functions** → **generate-monthly-report**

2. Click **"Invoke"** button

3. Add this body:
   ```json
   {
     "company_id": "your-actual-company-id-here"
   }
   ```

4. Click **"Send"** and watch the logs

5. Replace `your-actual-company-id-here` with your real company ID from the `companies` table

## ✅ Success Criteria

After the fix, you should see:

**In Supabase Logs**:
```
🧪 TEST MODE: Using LAST 30 DAYS data
Date range: 2025-09-23T00:00:00.000Z to 2025-10-23T23:59:59.999Z
Found junior users: [count]
Calculations query result: 96 records found
Found [X] active clients for [Company Name]
✅ PDF generated successfully
Sending to [Y] admins...
✅ Email sent to admin@example.com
```

**In Your Email Inbox**:
- Subject: "Spread Checker - Client Data Report (Last 30 Days...)"
- PDF attachment with all client calculations
- Summary showing 96 total calculations

## 📝 Notes

### Why Two Modes Exist

1. **PRODUCTION MODE**: For the actual monthly cron job that runs on the 1st of each month
   - Queries the complete previous calendar month
   - Ensures consistent, predictable date ranges

2. **TEST MODE**: For manual testing during development
   - Queries last 30 days to include recent test data
   - Allows testing without waiting for month-end

### Future Production Use

When the function runs automatically on the 1st of each month:
- It will use PRODUCTION mode (no company_id)
- It will query the complete previous month
- Example: On Nov 1, 2025, it queries all of October 2025

This is correct behavior for production. The test mode is specifically for manual testing with recent data.

## 🚨 Common Pitfalls to Avoid

1. **Don't test on the 1st of the month**: Production mode will query the previous month which might not have data yet

2. **Remember timezones**: All timestamps are UTC, but displayed in local time

3. **Check email spam folder**: First emails from new domain might be flagged

4. **Verify Resend API key**: Make sure `RESEND_API_KEY` is set in Supabase environment variables

## 📞 Support

If issues persist after this fix:
1. Check Supabase Edge Function logs for detailed error messages
2. Verify Resend API key is active and not rate-limited
3. Ensure `monthly_reports_enabled` and `client_data_enabled` are both `true` in the `companies` table
