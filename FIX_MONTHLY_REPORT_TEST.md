# Fix for Monthly Report Test Button

## Problem Identified
The `generate-monthly-report` edge function is querying **September 2025** data instead of **October 2025** data because:
1. The test button doesn't pass `company_id`, so it runs in PRODUCTION mode
2. PRODUCTION mode queries the "previous month" = September
3. TEST mode (triggered by `company_id`) queries the "last 30 days" = includes October

## Root Cause
Your 96 calculations were done in **October 2025**, but the function is querying **September 2025** data.

##Solution Required

### Change #1: Fix AdminDashboard.tsx Test Button

**File**: `src/components/AdminDashboard.tsx`

**Find this function** (around line 425):
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();
      
    if (!profile?.company_id) return;
    
    const { data: { session } } = await supabase.auth.getSession();
    
    console.log('Sending test report request with company_id:', profile.company_id);
    
    const response = await supabase.functions.invoke('generate-monthly-report', {
      body: {
        company_id: profile.company_id // THIS IS THE KEY - triggers test mode
      },
      headers: {
        Authorization: `Bearer ${session?.access_token}`
      }
    });
    
    console.log('Test report response:', response);
    
    if (response.error) throw response.error;
    
    alert('Test report sent successfully! Check your email in a few moments.');
  } catch (error) {
    console.error('Error generating test report:', error);
    alert('Failed to generate test report. Please try again.');
  } finally {
    setTestingReport(false);
  }
};
```

## How to Test After Fix

1. Deploy the change to Vercel
2. Go to Admin Dashboard
3. Click "Send Test Report" button
4. Check Supabase logs - you should see:
   ```
   🧪 TEST MODE: Using LAST 30 DAYS data
   Date range: 2025-09-23T00:00:00.000Z to 2025-10-23T23:59:59.999Z
   ```
5. Check your email for the PDF report

## Why This Fixes It

- **Before**: No `company_id` passed → PRODUCTION mode → queries September 2025 → finds 0 calculations
- **After**: `company_id` passed → TEST mode → queries last 30 days → finds your 96 October calculations

## Additional Verification

After making this change, you can also manually test the edge function in Supabase:

1. Go to Supabase Dashboard → Edge Functions → generate-monthly-report
2. Click "Invoke" and add this body:
   ```json
   {
     "company_id": "your-company-id-here"
   }
   ```
3. Check the logs to confirm it's using the last 30 days date range
