import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY')!;
    const googleSearchEngineId = Deno.env.get('GOOGLE_SEARCH_ENGINE_ID')!;

    const { companyName, limit = 10 } = await req.json();

    console.log('Searching for competitors of:', companyName);

    // Try multiple search queries to get more results
    const searchStrategies = [
      `${companyName} similar companies UK fashion retail`,
      `${companyName} alternative brands UK clothing`,
      `companies like ${companyName} UK`,
      `${companyName} vs competitors UK fashion`,
      `best alternatives to ${companyName} UK clothing`
    ];

    const allExtractedCompanies = new Set<string>();
    
    // Try multiple searches to get more results
    for (let i = 0; i < Math.min(3, searchStrategies.length); i++) {
      const searchQuery = searchStrategies[i];
      const googleSearchUrl = `https://customsearch.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleSearchEngineId}&q=${encodeURIComponent(searchQuery)}&num=10`;
      
      console.log(`Search attempt ${i + 1}: ${searchQuery}`);
      
      try {
        const googleResponse = await fetch(googleSearchUrl);
        
        if (!googleResponse.ok) {
          console.error(`Search ${i + 1} failed:`, googleResponse.status);
          continue;
        }
        
        const googleData = await googleResponse.json();
        console.log(`Search ${i + 1} returned`, googleData.items?.length || 0, 'results');

        if (googleData.items && googleData.items.length > 0) {
          // Extract text from results
          const extractedText = googleData.items
            .map((item: any) => `${item.title} ${item.snippet}`)
            .join(' ');

          // Extract company names
          const companies = extractCompanyNames(extractedText);
          companies.forEach(name => allExtractedCompanies.add(name));
        }
      } catch (error) {
        console.error(`Search ${i + 1} error:`, error);
        continue;
      }
    }

    console.log('All extracted companies before filtering:', Array.from(allExtractedCompanies));

    // CRITICAL: Remove the searched company from results (case-insensitive)
    const searchedCompanyLower = companyName.toLowerCase().trim();
    const filteredCompanies = Array.from(allExtractedCompanies).filter(company => {
      const companyLower = company.toLowerCase().trim();
      // Exclude exact matches or very similar names
      return companyLower !== searchedCompanyLower && 
             !companyLower.includes(searchedCompanyLower) &&
             !searchedCompanyLower.includes(companyLower);
    });

    console.log('Filtered companies (excluding searched company):', filteredCompanies);

    // If we found no companies after filtering, return well-known alternatives
    if (filteredCompanies.length === 0) {
      console.log('No companies found, using fallback list');
      
      // Return suggested competitors based on company type
      const fallbackCompanies = getSuggestedCompetitors(companyName);
      
      const similarCompanies = fallbackCompanies.slice(0, limit).map(name => ({
        name: name,
        industry: 'Retail - Clothing',
        location: 'UK',
        size: 'Large',
        reasoning: 'Found by Spread Checker'
      }));

      return new Response(
        JSON.stringify({ 
          similarCompanies,
          totalMatches: similarCompanies.length,
          hasMore: false,
          message: 'Showing suggested similar companies'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format results (take up to limit)
    const similarCompanies = filteredCompanies.slice(0, limit).map(name => ({
      name: name,
      industry: 'Retail - Clothing',
      location: 'UK',
      size: 'Large',
      reasoning: 'Found by Spread Checker'
    }));

    console.log(`Returning ${similarCompanies.length} companies`);

    return new Response(
      JSON.stringify({ 
        similarCompanies,
        totalMatches: similarCompanies.length,
        hasMore: false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Extract company names from text
function extractCompanyNames(text: string): string[] {
  const companies = new Set<string>();
  
  // Comprehensive list of UK and international fashion retailers
  const knownRetailers = [
    // Fast fashion online
    'ASOS', 'Boohoo', 'Shein', 'Pretty Little Thing', 'PrettyLittleThing',
    'Missguided', 'Nasty Gal', 'Fashion Nova', 'Oh Polly', 'In The Style',
    
    // High street chains
    'Next', 'Primark', 'River Island', 'New Look', 'Topshop', 'Topman',
    'H&M', 'Zara', 'Marks & Spencer', 'M&S', 'Matalan', 'TK Maxx',
    'Peacocks', 'Dorothy Perkins', 'Burton', 'Miss Selfridge',
    
    // Premium high street
    'Superdry', 'AllSaints', 'Ted Baker', 'Reiss', 'Whistles',
    'Karen Millen', 'French Connection', 'Jack Wills', 'Joules',
    'Barbour', 'Fat Face', 'White Stuff', 'Crew Clothing',
    
    // International brands
    'Gap', 'Uniqlo', 'Mango', 'COS', 'Massimo Dutti',
    'Pull & Bear', 'Bershka', 'Stradivarius', 'Hollister',
    'Abercrombie', 'Urban Outfitters', 'American Eagle',
    
    // Department stores
    'Debenhams', 'House of Fraser', 'John Lewis', 'Selfridges',
    'Harrods', 'Harvey Nichols', 'Fenwicks',
    
    // Designer/Premium
    'Burberry', 'Paul Smith', 'Mulberry', 'Alexander McQueen',
    'Vivienne Westwood', 'Stella McCartney',
    
    // Sports/Athleisure
    'JD Sports', 'Sports Direct', 'Nike', 'Adidas', 'Puma',
    'Gymshark', 'Lululemon', 'Sweaty Betty',
    
    // Others
    'Boden', 'Phase Eight', 'Coast', 'Jigsaw', 'Hobbs',
    'LK Bennett', 'Seasalt', 'Toast', 'Baukjen', 'Arket',
    'Other Stories', 'Weekday', 'Monki', 'Meshki'
  ];

  // Check for retailers (case insensitive)
  for (const retailer of knownRetailers) {
    // Escape special regex characters
    const escapedRetailer = retailer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedRetailer}\\b`, 'i');
    if (regex.test(text)) {
      companies.add(retailer);
    }
  }

  console.log(`Found ${companies.size} known retailers in text`);

  return Array.from(companies);
}

// Get suggested competitors based on the company name
function getSuggestedCompetitors(companyName: string): string[] {
  const lowerName = companyName.toLowerCase();
  
  // Fast fashion/online competitors
  if (['asos', 'boohoo', 'shein', 'prettylittlething', 'missguided'].some(name => lowerName.includes(name))) {
    return ['ASOS', 'Boohoo', 'Shein', 'Pretty Little Thing', 'Missguided', 'Nasty Gal', 'Fashion Nova', 'Oh Polly', 'In The Style', 'New Look'];
  }
  
  // Premium high street
  if (['superdry', 'allsaints', 'reiss', 'ted baker', 'jack wills'].some(name => lowerName.includes(name))) {
    return ['AllSaints', 'Ted Baker', 'Reiss', 'Superdry', 'Jack Wills', 'French Connection', 'Whistles', 'Karen Millen', 'Joules', 'Barbour'];
  }
  
  // High street chains
  if (['next', 'primark', 'river island', 'new look', 'h&m', 'zara'].some(name => lowerName.includes(name))) {
    return ['Next', 'Primark', 'River Island', 'H&M', 'Zara', 'New Look', 'Topshop', 'Marks & Spencer', 'Matalan', 'TK Maxx'];
  }
  
  // Default: mix of fast fashion and high street
  return ['ASOS', 'Next', 'Boohoo', 'Shein', 'Primark', 'River Island', 'H&M', 'Zara', 'New Look', 'Pretty Little Thing'];
}
