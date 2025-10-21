import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { companyName, excludeCompanies = [], limit = 10, offset = 0 } = await req.json();

    console.log('Searching for companies similar to:', companyName);

    // Step 1: Find potential source companies (return top 5 matches)
    const { data: sourceCompanies, error: searchError } = await supabase
      .from('companies_house_data')
      .select('*')
      .ilike('company_name', `%${companyName}%`)
      .eq('company_status', 'Active')
      .not('sic_code1', 'is', null)
      .limit(10);

    if (searchError) {
      throw new Error(`Search error: ${searchError.message}`);
    }

    if (!sourceCompanies || sourceCompanies.length === 0) {
      return new Response(
        JSON.stringify({ 
          similarCompanies: [],
          message: 'Company not found. Try searching with a different name or check spelling.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prioritize retail/service companies over construction/manufacturing
    const prioritizedCompanies = sourceCompanies.sort((a, b) => {
      const aIsRetail = [a.sic_code1, a.sic_code2, a.sic_code3, a.sic_code4]
        .some(sic => sic?.startsWith('47') || sic?.startsWith('46')); // Retail/Wholesale
      const bIsRetail = [b.sic_code1, b.sic_code2, b.sic_code3, b.sic_code4]
        .some(sic => sic?.startsWith('47') || sic?.startsWith('46'));
      
      if (aIsRetail && !bIsRetail) return -1;
      if (!aIsRetail && bIsRetail) return 1;
      return 0;
    });

    const sourceCompany = prioritizedCompanies[0];
    console.log('Source company selected:', sourceCompany.company_name, 'SIC:', sourceCompany.sic_code1);

    // Step 2: Get SIC codes
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
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Find similar companies
    const orConditions = sicCodes
      .map(sic => `sic_code1.eq.${sic},sic_code2.eq.${sic},sic_code3.eq.${sic},sic_code4.eq.${sic}`)
      .join(',');

    const { data: candidateCompanies, error: candidatesError } = await supabase
      .from('companies_house_data')
      .select('*')
      .eq('company_status', 'Active')
      .neq('company_number', sourceCompany.company_number)
      .or(orConditions)
      .limit(100);

    if (candidatesError) {
      throw new Error(`Candidates error: ${candidatesError.message}`);
    }

    if (!candidateCompanies || candidateCompanies.length === 0) {
      return new Response(
        JSON.stringify({ 
          similarCompanies: [],
          message: 'No similar companies found in the same industry.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Score and filter
    const scoredCompanies = candidateCompanies
      .map(company => ({
        company,
        score: calculateSimilarityScore(sourceCompany, company),
      }))
      .filter(({ score }) => score > 0.8)
      .sort((a, b) => b.score - a.score);

    // Filter excluded
    let filteredCompanies = scoredCompanies;
    if (excludeCompanies.length > 0) {
      const normalizedExclusions = excludeCompanies.map((name: string) => 
        name.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
      );
      
      filteredCompanies = scoredCompanies.filter(({ company }) => {
        const normalized = company.company_name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        return !normalizedExclusions.includes(normalized);
      });
    }

    const totalMatches = filteredCompanies.length;
    filteredCompanies = filteredCompanies.slice(offset, offset + limit);

    // Step 5: Format results
    const similarCompanies = filteredCompanies.map(({ company }) => ({
      name: company.company_name,
      industry: getIndustryDescription(company.sic_code1 || company.sic_code2),
      location: [company.post_town, company.country].filter(Boolean).join(', ') || 'UK',
      size: getSizeDescription(company.accounts_category, company.num_mort_charges),
      reasoning: generateReasoning(sourceCompany, company, sicCodes),
    }));

    return new Response(
      JSON.stringify({ 
        similarCompanies,
        totalMatches,
        hasMore: (offset + limit) < totalMatches,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function calculateSimilarityScore(source: any, candidate: any): number {
  let score = 0;

  const sourceSICs = [source.sic_code1, source.sic_code2, source.sic_code3, source.sic_code4].filter(Boolean);
  const candidateSICs = [candidate.sic_code1, candidate.sic_code2, candidate.sic_code3, candidate.sic_code4].filter(Boolean);
  
  const exactMatch = sourceSICs.some(sic => candidateSICs.includes(sic));
  if (exactMatch) {
    score += 0.6;
  } else {
    const sourceSectors = sourceSICs.map(sic => sic?.substring(0, 2));
    const candidateSectors = candidateSICs.map(sic => sic?.substring(0, 2));
    const sectorMatch = sourceSectors.some(sector => candidateSectors.includes(sector));
    if (sectorMatch) score += 0.3;
  }

  const sourceSize = source.accounts_category?.toUpperCase() || '';
  const candidateSize = candidate.accounts_category?.toUpperCase() || '';
  
  if (sourceSize === candidateSize) {
    score += 0.4;
  } else if (
    (sourceSize.includes('GROUP') && candidateSize.includes('FULL')) ||
    (sourceSize.includes('FULL') && candidateSize.includes('GROUP'))
  ) {
    score += 0.35;
  } else if (!candidateSize.includes('MICRO') && !candidateSize.includes('DORMANT')) {
    score += 0.2;
  }

  if (source.num_mort_charges >= 5 && candidate.num_mort_charges >= 5) {
    score += 0.05;
  }

  return score;
}

function getSizeDescription(accountsCategory: string | null, numMortgages: number): string {
  const category = accountsCategory?.toUpperCase() || '';
  
  if (category.includes('GROUP')) return 'Large (Group)';
  if (category.includes('FULL')) return 'Medium-Large';
  if (category.includes('MEDIUM')) return 'Medium';
  if (category.includes('SMALL')) return 'Small';
  if (category.includes('MICRO')) return 'Micro';
  
  if (numMortgages >= 10) return 'Large';
  if (numMortgages >= 5) return 'Medium-Large';
  if (numMortgages >= 2) return 'Medium';
  return 'Small-Medium';
}

function getIndustryDescription(sicCode: string | null): string {
  if (!sicCode) return 'Unknown industry';
  
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

  if (sicDescriptions[sicCode]) return sicDescriptions[sicCode];

  const sector = sicCode.substring(0, 4);
  if (sicDescriptions[sector]) return sicDescriptions[sector];

  const sectorDescriptions: Record<string, string> = {
    '1': 'Manufacturing',
    '4': 'Wholesale/Retail',
    '5': 'Services',
    '6': 'Technology/IT',
    '7': 'Professional services',
    '8': 'Business services',
  };

  return sectorDescriptions[sicCode[0]] || `Industry ${sicCode}`;
}

function generateReasoning(source: any, candidate: any, sicCodes: string[]): string {
  const matchingSICs = sicCodes.filter(sic => 
    [candidate.sic_code1, candidate.sic_code2, candidate.sic_code3, candidate.sic_code4].includes(sic)
  );
  
  let reasoning = 'Same industry classification';
  if (matchingSICs.length > 1) reasoning = 'Multiple matching industry codes';
  if (candidate.accounts_category === source.accounts_category) reasoning += ', similar company size';
  
  return reasoning;
}
