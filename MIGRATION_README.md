# Phase 1 Migration Instructions

## Apply the Database Migration

You need to run the SQL migration in your Supabase dashboard:

### Option 1: Supabase Dashboard (Recommended)

1. Go to https://supabase.com/dashboard
2. Select your project: `wvzqxwvlozzbmdrqyify`
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy the entire contents of `supabase/migrations/20251018_create_leads_system.sql`
6. Paste into the SQL editor
7. Click **Run** (or press Cmd/Ctrl + Enter)

### Option 2: Supabase CLI (if installed)

```bash
# Navigate to project root
cd /Users/rossj/Desktop/broker-pitch-calc/fx-calculator-working-webapp

# Run migration
supabase db push
```

## Verify Migration Success

After running, verify the tables were created:

```sql
-- Run this in SQL Editor to check
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_leads', 'companies', 'similar_companies_cache');
```

You should see all three tables listed.

## Test the Helper Functions

After migration, test the TypeScript utilities:

```typescript
import { normalizeCompanyName, isSimilarCompany } from './lib/companyNameUtils';

// Test normalization
console.log(normalizeCompanyName("Superdry PLC")); // "superdry"
console.log(normalizeCompanyName("TESCO Stores Limited")); // "tesco stores"

// Test similarity
console.log(isSimilarCompany("Superdry PLC", "Superdry Limited")); // true
console.log(isSimilarCompany("ASDA", "Tesco")); // false
```

## What Was Created

### Tables:
1. **user_leads** - Stores companies saved by users
2. **companies** - Bulk Companies House data (empty for now, will populate in Phase 2)
3. **similar_companies_cache** - Precomputed similarity scores

### Indexes:
- Fast lookup by user_id, normalized_name
- Fast filtering by contacted status
- Full-text search on company names

### Security:
- Row Level Security (RLS) enabled
- Users can only see their own leads
- Companies table is read-only

### Helper Functions:
- `normalizeCompanyName()` - Smart duplicate detection
- `isSimilarCompany()` - Fuzzy matching
- `addOrUpdateLead()` - Auto-detect duplicates
- `getUserLeads()` - Fetch with filtering

## Next Steps

After migration succeeds:
✅ Phase 1 complete - Database ready
⏭️  Phase 2 - Update Calculator to auto-save leads
⏭️  Phase 3 - Build Leads Management page
⏭️  Phase 4 - Build Company Finder page
