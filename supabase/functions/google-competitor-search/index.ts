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

    // Step 1: Google Custom Search for competitors
    const searchQuery = `${companyName} competitors UK large clothing fashion retailers`;
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

    // Step 2: Extract text from Google results
    const searchResults = googleData.items.map((item: any) => ({
      title: item.title,
      snippet: item.snippet,
      url: item.link
    }));

    console.log('Search results:', JSON.stringify(searchResults, null, 2));

    // Step 3: Extract company names using known patterns
    const extractedText = googleData.items
      .map((item: any) => `${item.title} ${item.snippet}`)
      .join(' ');

    console.log('Combined text for parsing:', extractedText.substring(0, 500));

    const potentialCompanies = extractCompanyNames(extractedText);
    console.log('Extracted company names:', potentialCompanies);

    if (potentialCompanies.length === 0) {
      return new Response(
        JSON.stringify({ 
          similarCompanies: [],
          totalMatches: 0,
          hasMore: false,
          message: 'Could not extract company names from search results.',
          debug: {
            searchResultsCount: googleData.items.length,
            searchResults: searchResults
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Format results (just return company names for now)
    const similarCompanies = potentialCompanies.slice(0, limit).map(name => ({
      name: name,
      industry: 'Retail - Clothing',
      location: 'UK',
      size: 'Unknown',
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
          extractedCompanies: potentialCompanies
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
  
  // Common UK clothing retailers
  const knownRetailers = [
    'ASOS', 'Next', 'Boohoo', 'Primark', 'River Island', 'New Look', 
    'Topshop', 'Topman', 'H&M', 'Zara', 'Marks & Spencer', 'M&S',
    'JD Sports', 'Sports Direct', 'Debenhams', 'House of Fraser',
    'John Lewis', 'Monsoon', 'Ted Baker', 'Reiss', 'AllSaints',
    'Burberry', 'Barbour', 'Joules', 'Fat Face', 'White Stuff',
    'Boden', 'Phase Eight', 'Coast', 'Karen Millen', 'French Connection',
    'Matalan', 'TK Maxx', 'Peacocks', 'Dorothy Perkins', 'Burton',
    'Miss Selfridge', 'Warehouse', 'Oasis', 'Gap', 'Uniqlo'
  ];

  // Check for known retailers in the text (case insensitive)
  for (const retailer of knownRetailers) {
    const regex = new RegExp(`\\b${retailer}\\b`, 'gi');
    if (regex.test(text)) {
      companies.add(retailer);
    }
  }

  console.log(`Found ${companies.size} known retailers in text`);

  return Array.from(companies);
}
