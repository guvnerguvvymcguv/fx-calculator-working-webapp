# Phase 1: Lead Management System - Database Schema & Smart Name Matching

## What Was Built

### ✅ Database Schema
- **user_leads** table: Stores companies saved by users
- **companies** table: For bulk Companies House data (Phase 2)
- **similar_companies_cache** table: Precomputed similarity scores
- Enhanced **calculations** table with lead linking
- Full indexes for fast queries
- Row Level Security (RLS) policies

### ✅ Smart Name Matching
- `normalizeCompanyName()`: Removes punctuation, suffixes, standardizes
- `isSimilarCompany()`: Fuzzy matching with typo tolerance
- `calculateNameSimilarity()`: Similarity scoring (0-1)
- `findBestMatch()`: Find matching companies from list
- `extractSearchKeywords()`: Search term extraction

### ✅ Database Operations
- `addOrUpdateLead()`: Auto-detect and update duplicates
- `findExistingLead()`: Fuzzy search for existing leads
- `getUserLeads()`: Fetch with filtering
- `updateLeadContactedStatus()`: Toggle contacted
- `deleteLead()`: Remove leads
- `getLeadStats()`: User statistics
- `isCompanyInLeadList()`: Check if already added

## Features

1. **Duplicate Prevention**
   - "Superdry PLC" = "SUPERDRY" = "Superdry Ltd"
   - Automatic normalization on insert
   - Fuzzy matching for typos

2. **Smart Auto-Save**
   - Calculations auto-create leads
   - Marks as "contacted" automatically
   - Updates existing if found

3. **Row Level Security**
   - Users only see their own leads
   - Companies table read-only
   - Secure multi-tenant setup

## Testing

Run tests:
```bash
npx tsx src/lib/__tests__/companyNameUtils.test.ts
```

## Migration Instructions

See `MIGRATION_README.md` for detailed steps to apply the SQL migration.

## Next Phases

- **Phase 2**: Update Calculator to use new system
- **Phase 3**: Build Leads Management page (/leads)
- **Phase 4**: Build Company Finder page (/company-finder)
