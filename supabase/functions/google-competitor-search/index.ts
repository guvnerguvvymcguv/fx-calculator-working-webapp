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
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY')!;
    const googleSearchEngineId = Deno.env.get('GOOGLE_SEARCH_ENGINE_ID')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { companyName, limit = 10 } = await req.json();

    console.log('Searching for competitors of:', companyName);

    // Step 1: Google Custom Search for competitors
    const searchQuery = `${companyName} competitors UK large clothing fashion retailers`;
    const googleSearchUrl = `https://customsearch.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleSearchEngineId}&q=${encodeURIComponent(searchQuery)}&num=10`;
    
    console.log('Calling Google Custom Search...');
    const googleResponse = await fetch(googleSearchUrl);
    
    if (!googleResponse.ok) {
      const errorText = await googleResponse.text();
      throw new Error(`Google API error: ${googleResponse.status} - ${errorText}`);
    }
    
    const googleData = await googleResponse.json();
    console.log('Google returned', googleData.items?.length || 0, 'results');

    if (!googleData.items || googleData.items.length === 0) {
      return new Response(
        JSON.stringify({ 
          similarCompanies: [],
          totalMatches: 0,
          hasMore: false,
          message: 'No competitors found via Google search.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Extract company names from Google results
    const extractedText = googleData.items
      .map((item: any) => `${item.title} ${item.snippet}`)
      .join(' ');

    console.log('Extracted text for parsing:', extractedText.substring(0, 200) + '...');

    // Step 3: Extract potential company names using common patterns
    const potentialCompanies = extractCompanyNames(extractedText);
    console.log('Potential company names found:', potentialCompanies);

    if (potentialCompanies.length === 0) {
      return new Response(
        JSON.stringify({ 
          similarCompanies: [],
          totalMatches: 0,
          hasMore: false,
          message: 'Could not extract company names from search results.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Validate each company against Companies House
    console.log('Validating companies against Companies House...');
    const validatedCompanies = [];

    for (const companyName of potentialCompanies.slice(0, 20)) { // Check top 20
      try {
        const { data: companies, error } = await supabase
          .from('companies_house_data')
          .select('*')
          .ilike('company_name', `%${companyName}%`)
          .eq('company_status', 'Active')
          .limit(1);

        if (error || !companies || companies.length === 0) {
          console.log(`No match found for: ${companyName}`);
          continue;
        }

        const company = companies[0];
        
        // Check if it's a clothing company
        const clothingSICs = ['47710', '47711', '47721', '47722', '46420'];
        const hasClothingSIC = [
          company.sic_code1,
          company.sic_code2,
          company.sic_code3,
          company.sic_code4
        ].some(sic => clothingSICs.includes(sic));

        if (!hasClothingSIC) {
          console.log(`Not a clothing company: ${companyName}`);
          continue;
        }

        // Check if it's a large company (FULL or GROUP)
        const size = company.accounts_category?.toUpperCase() || '';
        const isLarge = size === 'FULL' || size === 'GROUP';

        if (!isLarge) {
          console.log(`Not a large company: ${companyName} (${size})`);
          continue;
        }

        // Add to validated list
        validatedCompanies.push({
          name: company.company_name,
          location: [company.post_town, company.country].filter(Boolean).join(', ') || 'UK',
          size: getSizeDescription(company.accounts_category),
          industry: getIndustryDescription(company.sic_code1 || company.sic_code2),
          reasoning: 'Found via Google search as competitor'
        });

        console.log(`✓ Validated: ${company.company_name}`);

        if (validatedCompanies.length >= limit) {
          break;
        }
      } catch (err) {
        console.error(`Error validating ${companyName}:`, err);
        continue;
      }
    }

    console.log(`Final validated companies: ${validatedCompanies.length}`);

    return new Response(
      JSON.stringify({ 
        similarCompanies: validatedCompanies,
        totalMatches: validatedCompanies.length,
        hasMore: false,
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

// Extract company names from text using common patterns
function extractCompanyNames(text: string): string[] {
  const companies = new Set<string>();
  
  // Common UK clothing retailers (fallback list)
  const knownRetailers = [
    'ASOS', 'Next', 'Boohoo', 'Primark', 'River Island', 'New Look', 
    'Topshop', 'Topman', 'H&M', 'Zara', 'Marks & Spencer', 'M&S',
    'JD Sports', 'Sports Direct', 'Debenhams', 'House of Fraser',
    'John Lewis', 'Monsoon', 'Ted Baker', 'Reiss', 'AllSaints',
    'Burberry', 'Barbour', 'Joules', 'Fat Face', 'White Stuff',
    'Boden', 'Phase Eight', 'Coast', 'Karen Millen', 'French Connection'
  ];

  // Check for known retailers in the text
  for (const retailer of knownRetailers) {
    const regex = new RegExp(`\\b${retailer}\\b`, 'gi');
    if (regex.test(text)) {
      companies.add(retailer);
    }
  }

  // Also try to extract "Company Ltd", "Company PLC", etc.
  const companyPatterns = [
    /([A-Z][a-zA-Z\s&]+(?:Ltd|Limited|PLC|plc|Group))/g,
    /([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})/g
  ];

  for (const pattern of companyPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const cleaned = match.trim();
        if (cleaned.length > 3 && cleaned.length < 50) {
          companies.add(cleaned);
        }
      });
    }
  }

  return Array.from(companies);
}

function getSizeDescription(accountsCategory: string | null): string {
  const category = accountsCategory?.toUpperCase() || '';
  
  if (category === 'GROUP') return 'Large (Group)';
  if (category === 'FULL') return 'Large (Full Accounts)';
  if (category.includes('MEDIUM')) return 'Medium';
  if (category.includes('SMALL')) return 'Small';
  if (category.includes('MICRO')) return 'Micro';
  
  return 'Size Unknown';
}

function getIndustryDescription(sicCode: string | null): string {
  if (!sicCode) return 'Unknown industry';
  
  const sicDescriptions: Record<string, string> = {
    '47710': 'Retail - Clothing',
    '47711': 'Retail - Clothing',
    '47721': 'Retail - Footwear',
    '47722': 'Retail - Leather goods',
    '46420': 'Wholesale - Clothing & footwear',
    '14131': 'Manufacturing - Apparel',
    '14141': 'Manufacturing - Underwear',
    '14190': 'Manufacturing - Apparel',
  };

  if (sicDescriptions[sicCode]) return sicDescriptions[sicCode];

  const sector = sicCode.substring(0, 2);
  const sectorDescriptions: Record<string, string> = {
    '14': 'Manufacturing - Apparel',
    '46': 'Wholesale Trade',
    '47': 'Retail Trade',
  };

  return sectorDescriptions[sector] || `Industry ${sicCode}`;
}
