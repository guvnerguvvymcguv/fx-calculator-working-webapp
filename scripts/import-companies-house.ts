import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: '.env.local' });

// Supabase connection
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables!');
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY in your .env.local file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Invalid SIC codes to filter out
const INVALID_SIC_CODES = [
  '99999', // Dormant companies
  '70100', // Head offices/holding companies
  '64200', // Activities of holding companies
  '82990', // Other business support (often dormant)
];

// Statistics
let stats = {
  totalRows: 0,
  validCompanies: 0,
  skippedDormant: 0,
  skippedInactivte: 0,
  skippedNoSIC: 0,
  skippedInvalidSIC: 0,
  imported: 0,
  errors: 0,
};

interface CompanyRow {
  CompanyName: string;
  CompanyNumber: string;
  'RegAddress.PostCode': string;
  'RegAddress.PostTown': string;
  'RegAddress.Country': string;
  CompanyCategory: string;
  CompanyStatus: string;
  IncorporationDate: string;
  'Accounts.AccountCategory': string;
  'SICCode.SicText_1': string;
  'SICCode.SicText_2': string;
  'SICCode.SicText_3': string;
  'SICCode.SicText_4': string;
  'Mortgages.NumMortCharges': string;
}

// Parse CSV line (handles quoted fields with commas)
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// Extract SIC code number from text (e.g., "70229 - Management consultancy" → "70229")
function extractSICCode(sicText: string): string | null {
  if (!sicText || sicText.trim() === '') return null;
  const match = sicText.match(/^(\d{5})/);
  return match ? match[1] : null;
}

// Check if company should be imported
function shouldImportCompany(row: CompanyRow): { import: boolean; reason?: string } {
  // Check status - must be Active
  if (row.CompanyStatus?.toLowerCase() !== 'active') {
    stats.skippedInactivte++;
    return { import: false, reason: 'inactive' };
  }

  // Extract all SIC codes
  const sicCodes = [
    extractSICCode(row['SICCode.SicText_1']),
    extractSICCode(row['SICCode.SicText_2']),
    extractSICCode(row['SICCode.SicText_3']),
    extractSICCode(row['SICCode.SicText_4']),
  ].filter(Boolean) as string[];

  // Must have at least one SIC code
  if (sicCodes.length === 0) {
    stats.skippedNoSIC++;
    return { import: false, reason: 'no SIC codes' };
  }

  // Check if ALL SIC codes are invalid (dormant/holding companies)
  const allInvalid = sicCodes.every(sic => INVALID_SIC_CODES.includes(sic));
  if (allInvalid) {
    stats.skippedInvalidSIC++;
    return { import: false, reason: 'invalid SIC codes' };
  }

  // Check if dormant
  if (row['Accounts.AccountCategory']?.toUpperCase().includes('DORMANT')) {
    stats.skippedDormant++;
    return { import: false, reason: 'dormant' };
  }

  return { import: true };
}

// Process and insert batch
async function insertBatch(batch: any[]) {
  if (batch.length === 0) return;

  console.log(`🔄 Attempting to upsert batch of ${batch.length} companies...`);
  
  const { data, error } = await supabase
    .from('companies_house_data')
    .upsert(batch, { 
      onConflict: 'company_number',
      ignoreDuplicates: false 
    });

  if (error) {
    console.error('❌ Batch upsert error:', error.message);
    console.error('Error details:', JSON.stringify(error, null, 2));
    console.error('Sample row causing issue:', JSON.stringify(batch[0], null, 2));
    stats.errors += batch.length;
  } else {
    stats.imported += batch.length;
    console.log(`✅ Successfully upserted ${batch.length} companies`);
  }
}

// Main import function
async function importCompaniesHouseData(csvPath: string) {
  console.log('🚀 Starting Companies House data import...\n');
  console.log('📁 File:', csvPath);
  console.log('🗄️  Supabase URL:', SUPABASE_URL);
  console.log('🔍 Filters:');
  console.log('   - Active companies only');
  console.log('   - Valid SIC codes (excluding dormant/holding companies)');
  console.log('   - Skipping companies with no SIC codes\n');

  const fileStream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let headers: string[] = [];
  let batch: any[] = [];
  const BATCH_SIZE = 1000; // Insert 1000 at a time
  let isFirstLine = true;

  const startTime = Date.now();

  for await (const line of rl) {
    stats.totalRows++;

    // Parse header
    if (isFirstLine) {
      headers = parseCSVLine(line);
      isFirstLine = false;
      continue;
    }

    // Parse row
    const values = parseCSVLine(line);
    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    // Check if should import
    const check = shouldImportCompany(row);
    if (!check.import) {
      continue;
    }

    // Extract SIC codes
    const sicCodes = [
      extractSICCode(row['SICCode.SicText_1']),
      extractSICCode(row['SICCode.SicText_2']),
      extractSICCode(row['SICCode.SicText_3']),
      extractSICCode(row['SICCode.SicText_4']),
    ].filter(Boolean);

    // Calculate postcode prefix (first 2-3 chars)
    const postcode = row['RegAddress.PostCode'] || '';
    const postcodePrefix = postcode.replace(/\s+/g, '').substring(0, 3).toUpperCase();

    // Calculate company age
    const incorporationDate = row['IncorporationDate'];
    let companyAge = 0;
    if (incorporationDate) {
      const incDate = new Date(incorporationDate.split('/').reverse().join('-'));
      const now = new Date();
      companyAge = Math.floor((now.getTime() - incDate.getTime()) / (1000 * 60 * 60 * 24 * 365));
    }

    // Prepare data for insert
    const companyData = {
      company_number: row['CompanyNumber'],
      company_name: row['CompanyName'],
      company_status: row['CompanyStatus'],
      company_type: row['CompanyCategory'],
      sic_code1: sicCodes[0] || null,
      sic_code2: sicCodes[1] || null,
      sic_code3: sicCodes[2] || null,
      sic_code4: sicCodes[3] || null,
      accounts_category: row['Accounts.AccountCategory'] || null,
      num_mort_charges: parseInt(row['Mortgages.NumMortCharges']) || 0,
      postcode: postcode || null,
      postcode_prefix: postcodePrefix || null,
      post_town: row['RegAddress.PostTown'] || null,
      county: row['RegAddress.County'] || null,
      country: row['RegAddress.Country'] || null,
      address_line1: row['RegAddress.AddressLine1'] || null,
      date_of_creation: incorporationDate ? new Date(incorporationDate.split('/').reverse().join('-')).toISOString().split('T')[0] : null,
      company_age: companyAge,
      last_updated: new Date().toISOString(),
    };

    batch.push(companyData);
    stats.validCompanies++;

    // Insert batch when full
    if (batch.length >= BATCH_SIZE) {
      await insertBatch(batch);
      batch = [];

      // Progress update every 10,000 rows
      if (stats.totalRows % 10000 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        const rate = Math.floor(stats.totalRows / parseInt(elapsed));
        console.log(`📊 Progress: ${stats.totalRows.toLocaleString()} rows processed | ${stats.imported.toLocaleString()} imported | ${rate}/s`);
      }
    }
  }

  // Insert remaining batch
  if (batch.length > 0) {
    await insertBatch(batch);
  }

  // Final statistics
  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log('\n✅ Import complete!\n');
  console.log('📈 Statistics:');
  console.log(`   Total rows processed: ${stats.totalRows.toLocaleString()}`);
  console.log(`   Valid companies found: ${stats.validCompanies.toLocaleString()}`);
  console.log(`   Successfully imported: ${stats.imported.toLocaleString()}`);
  console.log(`   Skipped (inactive): ${stats.skippedInactivte.toLocaleString()}`);
  console.log(`   Skipped (dormant): ${stats.skippedDormant.toLocaleString()}`);
  console.log(`   Skipped (no SIC): ${stats.skippedNoSIC.toLocaleString()}`);
  console.log(`   Skipped (invalid SIC): ${stats.skippedInvalidSIC.toLocaleString()}`);
  console.log(`   Errors: ${stats.errors.toLocaleString()}`);
  console.log(`   Time taken: ${totalTime} minutes`);
  console.log(`\n🎉 Done! ${stats.imported.toLocaleString()} companies now in Supabase.`);
}

// Run the import
const csvPath = process.argv[2] || path.join(process.env.HOME || '', 'Desktop', 'BasicCompanyDataAsOneFile-2025-10-01.csv');

if (!fs.existsSync(csvPath)) {
  console.error('❌ CSV file not found:', csvPath);
  console.error('\nUsage: npm run import-companies [path-to-csv]');
  console.error('Example: npm run import-companies ~/Desktop/BasicCompanyDataAsOneFile-2025-10-01.csv');
  process.exit(1);
}

importCompaniesHouseData(csvPath).catch(console.error);
