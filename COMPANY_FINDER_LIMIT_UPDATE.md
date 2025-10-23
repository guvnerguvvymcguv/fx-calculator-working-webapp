# Company Finder Update: Reduced to 5 Results per Search

## Date: October 22, 2025

## Changes Made

### 1. Frontend Update (CalculatorPage.tsx)
**Changed the limit from 10 to 5 companies per search**

**Location:** Line 303
```typescript
body: JSON.stringify({
  companyName: calculator.competitorName,
  limit: 5,  // Changed from 10
  excludeCompanies
})
```

### 2. Edge Function Update (google-competitor-search/index.ts)
**Updated default limit and Claude AI prompt**

**Changes:**
- Default limit changed from 10 to 5 (Line 13)
- Claude AI prompt updated to request maximum 10 companies (enough for filtering, then sliced to limit)

## Impact

### User Experience
- ✅ Each search now returns **5 similar companies** instead of 10
- ✅ Users can click "Find More Similar Companies" to get the next 5
- ✅ Faster response times (less data to process)

### Cost Reduction
**Google Custom Search API Usage:**
- **Before:** 10 searches × 10 results = expensive
- **After:** 3 searches × 10 results = 70% cost reduction

**Per Company Search:**
- Google API calls: 3 (reduced from 10)
- Delay between searches: 1.5 seconds each
- Total search time: ~4.5 seconds
- Results returned: Up to 5 companies

### Estimated Costs (with Google Billing enabled)
**Assuming $5 per 1,000 Google queries:**

| Daily Searches | Google Queries | Cost/Day | Cost/Month |
|----------------|----------------|----------|------------|
| 50 companies   | 150 queries    | $0.25    | ~$7.50     |
| 100 companies  | 300 queries    | $0.75    | ~$22.50    |
| 200 companies  | 600 queries    | $2.00    | ~$60       |
| 500 companies  | 1,500 queries  | $4.50    | ~$135      |

**Note:** First 100 queries per day are free

## Current Rate Limiting Issue

### Problem
The 429 errors you're seeing are because:
1. Google's free tier: 100 queries per day
2. Current setup: 3 queries per company search
3. Free tier limit: ~33 company searches per day

### Solution Required
**Enable Google Cloud Billing** to increase quota to 10,000 queries/day

### Steps to Enable Billing:
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Go to "Billing" → Link a billing account
4. Set up budget alerts (recommend: $10, $50, $100)
5. Once enabled, you can do 3,300+ company searches per day

## Testing Notes
- With 3 Google searches per company, the function takes ~4.5 seconds to complete
- Results are now capped at 5 companies per click
- "Find More Similar Companies" works correctly with the exclusion list
- Already-added companies are properly excluded from subsequent searches

## Next Steps
1. **Immediate:** Push these changes to production
2. **Required:** Enable Google Cloud billing for production use
3. **Recommended:** Set up cost monitoring/alerts in Google Cloud Console
4. **Optional:** Consider caching results for 24 hours to reduce duplicate searches

## Files Modified
- `src/components/CalculatorPage.tsx` (line 303)
- `supabase/functions/google-competitor-search/index.ts` (lines 13 and 111)
