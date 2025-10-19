import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface CompanySearchResult {
  company_number: string;
  company_name: string;
  sic_code1: string | null;
  sic_code2: string | null;
  sic_code3: string | null;
  sic_code4: string | null;
  accounts_category: string | null;
  company_type: string;
  postcode_prefix: string | null;
  post_town: string | null;
  country: string | null;
  company_age: number;
  num_mort_charges: number;
}

interface SimilarCompany {
  name: string;
  industry: string;
  location: string;
  size: string;
  reasoning: string;
}

// Calculate similarity score based on multiple factors
function calculateSimilarityScore(
  source: CompanySearchResult,
  candidate: CompanySearchResult
): number {
  let score = 0;

  // SIC Code matching (60% weight) - MOST IMPORTANT
  const sourceSICs = [source.sic_code1, source.sic_code2, source.sic_code3, source.sic_code4].filter(Boolean);
  const candidateSICs = [candidate.sic_code1, candidate.sic_code2, candidate.sic_code3, candidate.sic_code4].filter(Boolean);
  
  // Exact SIC match
  const exactMatch = sourceSICs.some(sic => candidateSICs.includes(sic));
  if (exactMatch) {
    score += 0.6;
  } else {
    // Same sector match (first 2 digits)
    const sourceSectors = sourceSICs.map(sic => sic?.substring(0, 2));
    const candidateSectors = candidateSICs.map(sic => sic?.substring(0, 2));
    const sectorMatch = sourceSectors.some(sector => candidateSectors.includes(sector));
    if (sectorMatch) {
      score += 0.3;
    }
  }

  // Size matching (40% weight) - IMPORTANT
  const sourceSize = source.accounts_category?.toUpperCase() || '';
  const candidateSize = candidate.accounts_category?.toUpperCase() || '';
  
  if (sourceSize === candidateSize) {
    score += 0.4; // Exact size match
  } else if (
    (sourceSize.includes('GROUP') && candidateSize.includes('FULL')) ||
    (sourceSize.includes('FULL') && candidateSize.includes('GROUP'))
  ) {
    score += 0.35; // Close size match
  } else if (
    !candidateSize.includes('MICRO') && 
    !candidateSize.includes('DORMANT')
  ) {
    score += 0.2; // At least not micro
  }

  // Bonus for similar mortgage charges (size indicator)
  if (source.num_mort_charges >= 5 && candidate.num_mort_charges >= 5) {
    score += 0.05;
  }

  return score;
}

// Get readable size description
function getSizeDescription(accountsCategory: string | null, numMortgages: number): string {
  const category = accountsCategory?.toUpperCase() || '';
  
  if (category.includes('GROUP')) return 'Large (Group)';
  if (category.includes('FULL')) return 'Medium-Large';
  if (category.includes('MEDIUM')) return 'Medium';
  if (category.includes('SMALL')) return 'Small';
  if (category.includes('MICRO')) return 'Micro';
  
  // Use mortgages as fallback
  if (numMortgages >= 10) return 'Large';
  if (numMortgages >= 5) return 'Medium-Large';
  if (numMortgages >= 2) return 'Medium';
  return 'Small-Medium';
}

// Get readable industry description from SIC code
function getIndustryDescription(sicCode: string | null): string {
  if (!sicCode) return 'Unknown industry';
  
  // Common SIC codes mapped to readable descriptions
  const sicDescriptions: Record<string, string> = {
    '47110': 'Retail - Supermarkets',
    '47190': 'Retail - Non-specialized stores',
    '47710': 'Retail - Clothing',
    '47910': 'Retail - Online/mail order',
    '46420': 'Wholesale - Clothing & footwear',
    '70229': 'Management consultancy',
    '62012': 'Software development',
    '58290': 'Software publishing',
    '82990': 'Business support services',
  };

  // Check first 5 digits
  if (sicDescriptions[sicCode]) {
    return sicDescriptions[sicCode];
  }

  // Check first 4 digits (sector)
  const sector = sicCode.substring(0, 4);
  if (sicDescriptions[sector]) {
    return sicDescriptions[sector];
  }

  // Generic descriptions by first digit
  const firstDigit = sicCode[0];
  const sectorDescriptions: Record<string, string> = {
    '1': 'Manufacturing',
    '4': 'Wholesale/Retail',
    '5': 'Services',
    '6': 'Technology/IT',
    '7': 'Professional services',
    '8': 'Business services',
  };

  return sectorDescriptions[firstDigit] || `Industry ${sicCode}`;
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { companyName } = await req.json();

    console.log('Searching for companies similar to:', companyName);

    // Step 1: Find the source company
    const { data: sourceCompanies, error: searchError } = await supabase
      .from('companies_house_data')
      .select('*')
      .ilike('company_name', `%${companyName}%`)
      .eq('company_status', 'Active')
      .not('sic_code1', 'is', null)
      .limit(5);

    if (searchError) {
      console.error('Search error:', searchError);
      return new Response(
        JSON.stringify({ error: 'Failed to search companies' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!sourceCompanies || sourceCompanies.length === 0) {
      console.log('No companies found matching:', companyName);
      return new Response(
        JSON.stringify({ 
          similarCompanies: [],
          message: 'Company not found. Try searching with a different name or check spelling.'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Use the first valid company found
    const sourceCompany = sourceCompanies[0];

    console.log('Source company found:', {
      name: sourceCompany.company_name,
      sic_codes: [sourceCompany.sic_code1, sourceCompany.sic_code2, sourceCompany.sic_code3, sourceCompany.sic_code4].filter(Boolean),
      accounts_category: sourceCompany.accounts_category,
    });

    // Step 2: Find similar companies
    // Build query to find companies with matching SIC codes
    const sicCodes = [
      sourceCompany.sic_code1,
      sourceCompany.sic_code2,
      sourceCompany.sic_code3,
      sourceCompany.sic_code4,
    ].filter(Boolean);

    if (sicCodes.length === 0) {
      return new Response(
        JSON.stringify({ 
          similarCompanies: [],
          message: 'Source company has no industry codes. Cannot find similar companies.'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Query for companies with matching SIC codes
    let query = supabase
      .from('companies_house_data')
      .select('*')
      .eq('company_status', 'Active')
      .neq('company_number', sourceCompany.company_number); // Exclude source company itself

    // Add SIC code OR conditions
    const orConditions = sicCodes
      .map(sic => `sic_code1.eq.${sic},sic_code2.eq.${sic},sic_code3.eq.${sic},sic_code4.eq.${sic}`)
      .join(',');
    
    query = query.or(orConditions);

    // Limit results
    query = query.limit(100);

    const { data: candidateCompanies, error: candidatesError } = await query;

    if (candidatesError) {
      console.error('Candidates search error:', candidatesError);
      return new Response(
        JSON.stringify({ error: 'Failed to find similar companies' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${candidateCompanies?.length || 0} candidate companies`);

    if (!candidateCompanies || candidateCompanies.length === 0) {
      return new Response(
        JSON.stringify({ 
          similarCompanies: [],
          message: 'No similar companies found in the same industry.'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Score and rank companies
    const scoredCompanies = candidateCompanies
      .map(company => ({
        company,
        score: calculateSimilarityScore(sourceCompany, company),
      }))
      .filter(({ score }) => score > 0.5) // Only keep good matches
      .sort((a, b) => b.score - a.score) // Sort by score descending
      .slice(0, 10); // Top 10

    console.log(`After scoring: ${scoredCompanies.length} companies with score > 0.5`);

    // Step 4: Format results
    const similarCompanies: SimilarCompany[] = scoredCompanies.map(({ company }) => {
      const primarySIC = company.sic_code1 || company.sic_code2 || '';
      const industry = getIndustryDescription(primarySIC);
      const size = getSizeDescription(company.accounts_category, company.num_mort_charges);
      const location = [company.post_town, company.country].filter(Boolean).join(', ') || 'UK';

      // Generate reasoning
      const matchingSICs = sicCodes.filter(sic => 
        [company.sic_code1, company.sic_code2, company.sic_code3, company.sic_code4].includes(sic)
      );
      
      let reasoning = 'Same industry classification';
      if (matchingSICs.length > 1) {
        reasoning = 'Multiple matching industry codes';
      }
      if (company.accounts_category === sourceCompany.accounts_category) {
        reasoning += ', similar company size';
      }

      return {
        name: company.company_name,
        industry: industry,
        location: location,
        size: size,
        reasoning: reasoning,
      };
    });

    console.log(`Returning ${similarCompanies.length} similar companies`);

    return new Response(
      JSON.stringify({ 
        similarCompanies,
        debug: {
          sourceCompany: sourceCompany.company_name,
          sicCodes: sicCodes,
          candidatesFound: candidateCompanies.length,
          afterScoring: scoredCompanies.length,
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
