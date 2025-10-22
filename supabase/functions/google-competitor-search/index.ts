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

    // Try multiple search strategies
    const searchStrategies = [
      `${companyName} similar companies UK fashion retail`,
      `${companyName} alternative brands UK clothing`,
      `companies like ${companyName} UK fashion`,
      `${companyName} vs competitors analysis UK retail`
    ];

    let allExtractedCompanies = new Set<string>();
    
    // Try the first search strategy
    const searchQuery = searchStrategies[0];
    const googleSearchUrl = `https://customsearch.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleSearchEngineId}&q=${encodeURIComponent(searchQuery)}&num=10`;
    
    console.log('Calling Google Custom Search API...');
    console.log('Search query:', searchQuery);
    
    const googleResponse = await fetch(googleSearchUrl);
    
    if (!googleResponse.ok) {
      const errorText = await googleResponse.text();
      console.error('Google API error:', googleResponse.status, errorText);
      throw new Error(`Google API error: ${googleResponse.status} - ${errorText}`);
    }
    
    const googleData = await googleResponse.json();
    console.log('Google returned', googleData.items?.length || 0, 'search results');

    if (!googleData.items || googleData.items.length === 0) {
      return new Response(
        JSON.stringify({ 
          similarCompanies: [],
          totalMatches: 0,
          hasMore: false,
          message: 'No search results found from Google.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log search results for debugging
    const searchResults = googleData.items.slice(0, 3).map((item: any) => ({
      title: item.title,
      snippet: item.snippet
    }));
    console.log('Search results:', JSON.stringify(searchResults, null, 2));

    // Extract text from Google results
    const extractedText = googleData.items
      .map((item: any) => `${item.title} ${item.snippet}`)
      .join(' ');

    console.log('Combined text for parsing (first 500 chars):', extractedText.substring(0, 500));

    // Extract company names
    const potentialCompanies = extractCompanyNames(extractedText);
    potentialCompanies.forEach(name => allExtractedCompanies.add(name));
    
    console.log('Extracted company names:', Array.from(allExtractedCompanies));

    // If we found no companies, return a helpful message
    if (allExtractedCompanies.size === 0) {
      // Return some well-known UK fashion retailers as fallback
      const fallbackCompanies = [
        'ASOS', 'Next', 'Boohoo', 'River Island', 'New Look',
        'H&M', 'Zara', 'Primark', 'Topshop', 'Marks & Spencer'
      ];
      
      const similarCompanies = fallbackCompanies.slice(0, limit).map(name => ({
        name: name,
        industry: 'Retail - Clothing',
        location: 'UK',
        size: 'Large',
        reasoning: 'Well-known UK fashion retailer (suggested match)'
      }));

      return new Response(
        JSON.stringify({ 
          similarCompanies,
          totalMatches: similarCompanies.length,
          hasMore: false,
          message: 'Using suggested UK fashion retailers',
          debug: {
            searchQuery,
            note: 'Google results did not contain recognizable competitor names'
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format results
    const companiesArray = Array.from(allExtractedCompanies);
    const similarCompanies = companiesArray.slice(0, limit).map(name => ({
      name: name,
      industry: 'Retail - Clothing',
      location: 'UK',
      size: 'Large',
      reasoning: 'Found via Google search'
    }));

    console.log(`Returning ${similarCompanies.length} companies`);

    return new Response(
      JSON.stringify({ 
        similarCompanies,
        totalMatches: similarCompanies.length,
        hasMore: false,
        debug: {
          searchQuery,
          extractedCompanies: companiesArray
        }
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
  
  // Expanded list of UK clothing retailers
  const knownRetailers = [
    // Major chains
    'ASOS', 'Next', 'Boohoo', 'Primark', 'River Island', 'New Look', 
    'Topshop', 'Topman', 'H&M', 'Zara', 'Marks & Spencer', 'M&S',
    'JD Sports', 'Sports Direct', 'Debenhams', 'House of Fraser',
    'John Lewis', 'Monsoon', 'Ted Baker', 'Reiss', 'AllSaints',
    'Burberry', 'Barbour', 'Joules', 'Fat Face', 'White Stuff',
    'Boden', 'Phase Eight', 'Coast', 'Karen Millen', 'French Connection',
    'Matalan', 'TK Maxx', 'Peacocks', 'Dorothy Perkins', 'Burton',
    'Miss Selfridge', 'Warehouse', 'Oasis', 'Gap', 'Uniqlo',
    // Additional retailers
    'Superdry', 'Jack Wills', 'Hollister', 'Abercrombie', 'Urban Outfitters',
    'Pretty Little Thing', 'Missguided', 'PrettyLittleThing', 'Nasty Gal',
    'Pull & Bear', 'Bershka', 'Stradivarius', 'Mango', 'COS',
    'Arket', 'Other Stories', 'Weekday', 'Monki', 'Massimo Dutti',
    'Ted Baker', 'Whistles', 'Jigsaw', 'Hobbs', 'LK Bennett',
    'Crew Clothing', 'Joules', 'Seasalt', 'Baukjen', 'Toast',
    // Online pure-plays
    'Shein', 'Fashion Nova', 'Oh Polly', 'In The Style', 'Meshki'
  ];

  // Check for known retailers (case insensitive)
  const lowerText = text.toLowerCase();
  
  for (const retailer of knownRetailers) {
    const lowerRetailer = retailer.toLowerCase();
    // Use word boundaries to avoid partial matches
    const regex = new RegExp(`\\b${lowerRetailer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(text)) {
      companies.add(retailer);
    }
  }

  console.log(`Found ${companies.size} known retailers in text`);

  return Array.from(companies);
}
