import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// CLOTHING & FASHION RETAIL - Precise whitelist for companies like Superdry
const CLOTHING_FASHION_PRECISE = [
  '47710', // Retail sale of clothing in specialized stores (MAIN - Superdry, Next, ASOS, etc.)
  '47711', // Retail sale of clothing in specialized stores (variant)
  '47721', // Retail sale of footwear in specialized stores
  '47722', // Retail sale of leather goods in specialized stores
  '46420', // Wholesale of clothing and footwear
  '14131', // Manufacture of other outerwear
  '14141', // Manufacture of underwear
  '14190', // Manufacture of other wearing apparel and accessories
];

// Generic codes to NEVER match (too broad)
const EXCLUDED_GENERIC_SICS = [
  '47910', // Online/mail order (includes tea, furniture, everything)
  '47190', // Non-specialized stores (supermarkets, variety stores)
];

// Company size tiers
type CompanySize = 'LARGE' | 'MEDIUM' | 'SMALL' | 'MICRO' | 'UNKNOWN';

function getCompanySize(accountsCategory: string | null): CompanySize {
  const category = accountsCategory?.toUpperCase() || '';
  
  // Large companies (exact match only)
  if (category === 'GROUP' || category === 'FULL') return 'LARGE';
  
  // Medium companies
  if (category === 'MEDIUM' || category.includes('MEDIUM')) return 'MEDIUM';
  
  // Small companies
  if (category === 'SMALL' || category.includes('SMALL')) return 'SMALL';
  
  // Micro companies
  if (category.includes('MICRO')) return 'MICRO';
  
  // Unknown/problematic categories (NO ACCOUNTS FILED, TOTAL EXEMPTION, etc.)
  return 'UNKNOWN';
}

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

    // Step 2: Filter source SIC codes to only clothing-specific ones (exclude generic)
    const sourceSICs = [
      sourceCompany.sic_code1,
      sourceCompany.sic_code2,
      sourceCompany.sic_code3,
      sourceCompany.sic_code4,
    ].filter(Boolean).filter(sic => !EXCLUDED_GENERIC_SICS.includes(sic));

    console.log('Source SICs after excluding generic codes:', sourceSICs);

    // Check if source company has ANY clothing-specific SIC codes
    const clothingSICs = sourceSICs.filter(sic => 
      CLOTHING_FASHION_PRECISE.some(wl => sic.startsWith(wl.substring(0, 5)))
    );

    console.log('Clothing-specific SICs found:', clothingSICs);

    if (clothingSICs.length === 0) {
      return new Response(
        JSON.stringify({ 
          similarCompanies: [],
          totalMatches: 0,
          hasMore: false,
          message: `${sourceCompany.company_name} does not appear to be a clothing/fashion retailer. Cannot find similar companies in this industry.`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Search ONLY for companies with clothing-specific SIC codes
    console.log('Searching with whitelist:', CLOTHING_FASHION_PRECISE);
    
    const orConditions = CLOTHING_FASHION_PRECISE
      .map(sic => `sic_code1.eq.${sic},sic_code2.eq.${sic},sic_code3.eq.${sic},sic_code4.eq.${sic}`)
      .join(',');

    const { data: candidateCompanies, error: candidatesError } = await supabase
      .from('companies_house_data')
      .select('*')
      .eq('company_status', 'Active')
      .neq('company_number', sourceCompany.company_number)
      .or(orConditions)
      .limit(2000);

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

    // Step 4: Filter by SIZE - EXACT tier matching
    const sourceSize = getCompanySize(sourceCompany.accounts_category);
    console.log('Source company size tier:', sourceSize);
    console.log('Source company accounts_category:', sourceCompany.accounts_category);

    let filteredCompanies = candidateCompanies;
    
    if (sourceSize === 'LARGE') {
      // If source is large, only show other LARGE companies
      filteredCompanies = candidateCompanies.filter(company => {
        return getCompanySize(company.accounts_category) === 'LARGE';
      });
      console.log(`Filtered to ${filteredCompanies.length} LARGE companies`);
    } else if (sourceSize === 'MEDIUM') {
      // If source is medium, only show MEDIUM companies
      filteredCompanies = candidateCompanies.filter(company => {
        return getCompanySize(company.accounts_category) === 'MEDIUM';
      });
      console.log(`Filtered to ${filteredCompanies.length} MEDIUM companies`);
    } else if (sourceSize === 'SMALL') {
      // If source is small, only show SMALL companies
      filteredCompanies = candidateCompanies.filter(company => {
        return getCompanySize(company.accounts_category) === 'SMALL';
      });
      console.log(`Filtered to ${filteredCompanies.length} SMALL companies`);
    } else {
      // MICRO or UNKNOWN - no filtering, show all
      console.log(`Source is ${sourceSize}, showing all sizes`);
    }

    if (filteredCompanies.length === 0) {
      return new Response(
        JSON.stringify({ 
          similarCompanies: [],
          totalMatches: 0,
          hasMore: false,
          message: `No companies found with matching industry codes and ${sourceSize} company size.`
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
      const aMatches = clothingSICs.filter(sic => 
        [a.sic_code1, a.sic_code2, a.sic_code3, a.sic_code4].includes(sic)
      ).length;
      const bMatches = clothingSICs.filter(sic => 
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

      const matchingSICs = clothingSICs.filter(sic => 
        [company.sic_code1, company.sic_code2, company.sic_code3, company.sic_code4].includes(sic)
      );
      
      let reasoning = `Clothing/fashion retailer (SIC ${matchingSICs.join(', ')})`;
      if (company.accounts_category === sourceCompany.accounts_category) {
        reasoning += ', same size';
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
  const size = getCompanySize(accountsCategory);
  const category = accountsCategory?.toUpperCase() || '';
  
  // Return human-readable descriptions based on tier
  if (size === 'LARGE') {
    if (category === 'GROUP') return 'Large (Group)';
    if (category === 'FULL') return 'Large (Full Accounts)';
    return 'Large';
  }
  
  if (size === 'MEDIUM') return 'Medium';
  if (size === 'SMALL') return 'Small';
  if (size === 'MICRO') return 'Micro';
  
  // Fallback for UNKNOWN
  if (numMortgages >= 10) return 'Large (High Debt)';
  if (numMortgages >= 5) return 'Medium-Large';
  if (numMortgages >= 2) return 'Medium';
  return 'Size Unknown';
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

