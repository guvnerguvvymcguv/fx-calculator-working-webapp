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

    // Step 1: Find the source company
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
          totalMatches: 0,
          hasMore: false,
          message: 'Company not found. Try searching with a different name or check spelling.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prioritize retail/wholesale companies
    const prioritizedCompanies = sourceCompanies.sort((a, b) => {
      const aIsRetail = [a.sic_code1, a.sic_code2, a.sic_code3, a.sic_code4]
        .some(sic => sic?.startsWith('47') || sic?.startsWith('46'));
      const bIsRetail = [b.sic_code1, b.sic_code2, b.sic_code3, b.sic_code4]
        .some(sic => sic?.startsWith('47') || sic?.startsWith('46'));
      
      if (aIsRetail && !bIsRetail) return -1;
      if (!aIsRetail && bIsRetail) return 1;
      return 0;
    });

    const sourceCompany = prioritizedCompanies[0];
    console.log('Source company:', sourceCompany.company_name);
    console.log('SIC codes:', [sourceCompany.sic_code1, sourceCompany.sic_code2, sourceCompany.sic_code3, sourceCompany.sic_code4].filter(Boolean));
    console.log('Size:', sourceCompany.accounts_category);

    // Step 2: Get EXACT SIC codes from source company
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
          totalMatches: 0,
          hasMore: false,
          message: 'Source company has no industry codes. Cannot find similar companies.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Find companies with EXACT SIC code matches
    const orConditions = sicCodes
      .map(sic => `sic_code1.eq.${sic},sic_code2.eq.${sic},sic_code3.eq.${sic},sic_code4.eq.${sic}`)
      .join(',');

    const { data: candidateCompanies, error: candidatesError } = await supabase
      .from('companies_house_data')
      .select('*')
      .eq('company_status', 'Active')
      .neq('company_number', sourceCompany.company_number)
      .or(orConditions)
      .limit(1000);

    if (candidatesError) {
      throw new Error(`Candidates error: ${candidatesError.message}`);
    }

    console.log(`Found ${candidateCompanies?.length || 0} companies with exact SIC match`);

    if (!candidateCompanies || candidateCompanies.length === 0) {
      return new Response(
        JSON.stringify({ 
          similarCompanies: [],
          totalMatches: 0,
          hasMore: false,
          message: 'No companies found with matching industry codes.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Filter by SIZE - only FULL or GROUP (large companies only)
    const sourceSize = sourceCompany.accounts_category?.toUpperCase() || '';
    const isSourceLarge = sourceSize.includes('FULL') || sourceSize.includes('GROUP');

    let filteredCompanies = candidateCompanies;
    
    if (isSourceLarge) {
      // If source is large, only show other large companies
      filteredCompanies = candidateCompanies.filter(company => {
        const candidateSize = company.accounts_category?.toUpperCase() || '';
        return candidateSize.includes('FULL') || candidateSize.includes('GROUP');
      });
      console.log(`Filtered to ${filteredCompanies.length} large companies (FULL or GROUP)`);
    } else {
      // If source is not large, show same size category
      filteredCompanies = candidateCompanies.filter(company => {
        return company.accounts_category?.toUpperCase() === sourceSize;
      });
      console.log(`Filtered to ${filteredCompanies.length} companies matching size: ${sourceSize}`);
    }

    if (filteredCompanies.length === 0) {
      return new Response(
        JSON.stringify({ 
          similarCompanies: [],
          totalMatches: 0,
          hasMore: false,
          message: `No companies found with matching industry codes and similar size (${sourceSize}).`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 5: Exclude already-shown companies
    if (excludeCompanies.length > 0) {
      const normalizedExclusions = excludeCompanies.map((name: string) => 
        name.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
      );
      
      filteredCompanies = filteredCompanies.filter(company => {
        const normalized = company.company_name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        return !normalizedExclusions.includes(normalized);
      });
    }

    const totalMatches = filteredCompanies.length;
    
    // Step 6: Sort by number of matching SIC codes (more matches = more relevant)
    filteredCompanies.sort((a, b) => {
      const aMatches = sicCodes.filter(sic => 
        [a.sic_code1, a.sic_code2, a.sic_code3, a.sic_code4].includes(sic)
      ).length;
      const bMatches = sicCodes.filter(sic => 
        [b.sic_code1, b.sic_code2, b.sic_code3, b.sic_code4].includes(sic)
      ).length;
      return bMatches - aMatches;
    });

    // Step 7: Apply pagination
    const paginatedCompanies = filteredCompanies.slice(offset, offset + limit);

    // Step 8: Format results
    const similarCompanies = paginatedCompanies.map(company => {
      const primarySIC = company.sic_code1 || company.sic_code2 || '';
      const industry = getIndustryDescription(primarySIC);
      const size = getSizeDescription(company.accounts_category, company.num_mort_charges);
      const location = [company.post_town, company.country].filter(Boolean).join(', ') || 'UK';

      const matchingSICs = sicCodes.filter(sic => 
        [company.sic_code1, company.sic_code2, company.sic_code3, company.sic_code4].includes(sic)
      );
      
      let reasoning = `Exact industry match (SIC ${matchingSICs.join(', ')})`;
      if (company.accounts_category === sourceCompany.accounts_category) {
        reasoning += ', same company size';
      }

      return {
        name: company.company_name,
        industry,
        location,
        size,
        reasoning,
      };
    });

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

