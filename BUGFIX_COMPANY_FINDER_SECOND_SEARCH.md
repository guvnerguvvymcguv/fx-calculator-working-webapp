# Bug Fix: Company Finder Second Search Issue

## Date: October 22, 2025

## Problem Summary
The "Find More Similar Companies" button was not working correctly on the second search. After the first search showed results, clicking the button again would return a "No More Similar Companies Found" message even though there were more companies available.

## Root Cause
The issue was caused by incorrect column names in database queries. The code was querying for `company_name` when the actual column name in the `user_leads` table is `custom_name`.

### Error Details
```
Error loading existing leads: 
code: "42703"
details: null
hint: "Perhaps you meant to reference the column "user_leads.company_name"."
message: "column user_leads.company_name does not exist"
```

This error prevented the exclusion list from being built properly, causing the API to return the same companies on subsequent searches.

## Files Modified
- `src/components/CalculatorPage.tsx`

## Changes Made

### Change 1: Fixed `loadExistingLeads()` function (Line 75-90)
**Before:**
```typescript
const { data: leads, error } = await supabase
  .from('user_leads')
  .select('company_name')  // ❌ Wrong column
  .eq('user_id', currentUser.id);

if (leads && leads.length > 0) {
  const companyNames = new Set(leads.map(lead => lead.company_name.toLowerCase()));
  setAddedCompanies(companyNames);
}
```

**After:**
```typescript
const { data: leads, error } = await supabase
  .from('user_leads')
  .select('custom_name')  // ✅ Correct column
  .eq('user_id', currentUser.id);

if (leads && leads.length > 0) {
  const companyNames = new Set(leads.map(lead => lead.custom_name.toLowerCase()));
  setAddedCompanies(companyNames);
}
```

### Change 2: Fixed `handleFindSimilarCompanies()` function (Line 273-280)
**Before:**
```typescript
const { data: myLeads } = await supabase
  .from('user_leads')
  .select('company_name')  // ❌ Wrong column
  .eq('user_id', currentUser.id);

const companiesInMyLeads = myLeads?.map(lead => lead.company_name) || [];
```

**After:**
```typescript
const { data: myLeads } = await supabase
  .from('user_leads')
  .select('custom_name')  // ✅ Correct column
  .eq('user_id', currentUser.id);

const companiesInMyLeads = myLeads?.map(lead => lead.custom_name) || [];
```

## Impact & Resolution
These changes fix the following issues:

1. ✅ `loadExistingLeads()` now successfully loads existing leads when the component mounts
2. ✅ The `addedCompanies` state is properly populated with companies already in the user's list
3. ✅ The exclusion list in `handleFindSimilarCompanies()` now correctly includes companies from the user's leads
4. ✅ The second (and subsequent) searches now properly exclude both shown companies and companies in the user's list
5. ✅ Users can now successfully find more similar companies on repeated searches

## Testing Recommendations
1. Perform a calculation with a company name
2. Click "Find Similar Companies" - should show 5-10 companies
3. Click "Find More Similar Companies" - should now show DIFFERENT companies (not duplicates)
4. Add some companies to "My Leads"
5. Search again - those added companies should be excluded from future results

## Database Schema Reference
The `user_leads` table uses:
- `custom_name` - The display name of the company (what users see)
- `normalized_name` - The normalized version for matching (lowercase, special chars removed)

NOT `company_name` (which doesn't exist in this table)
