import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY')!;
    const googleSearchEngineId = Deno.env.get('GOOGLE_SEARCH_ENGINE_ID')!;
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')!;

    const { companyName, limit = 5, excludeCompanies = [] } = await req.json();

    console.log('Searching for competitors of:', companyName);

    // Reduced search strategies to avoid rate limiting (Google allows ~1 request/second)
    const searchStrategies = [
      `${companyName} competitors UK`,
      `${companyName} similar companies UK`,
      `companies like ${companyName} UK`
    ];

    let allGoogleText = '';
    
    // Run multiple searches and combine results
    for (let i = 0; i < searchStrategies.length; i++) {
      const searchQuery = searchStrategies[i];
      const googleSearchUrl = `https://customsearch.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleSearchEngineId}&q=${encodeURIComponent(searchQuery)}&num=10`;
      
      console.log(`Search ${i + 1}/${searchStrategies.length}: ${searchQuery}`);
      
      try {
        const googleResponse = await fetch(googleSearchUrl);
        
        if (!googleResponse.ok) {
          console.error(`Search ${i + 1} failed:`, googleResponse.status);
          continue;
        }
        
        const googleData = await googleResponse.json();
        const resultCount = googleData.items?.length || 0;
        console.log(`Search ${i + 1} returned ${resultCount} results`);

        if (googleData.items && googleData.items.length > 0) {
          // Extract text from results
          const extractedText = googleData.items
            .map((item: any) => `${item.title}\n${item.snippet}`)
            .join('\n\n');
          
          allGoogleText += extractedText + '\n\n';
        }

        // Reduced delay since billing is enabled (300ms is sufficient)
        if (i < searchStrategies.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (error) {
        console.error(`Search ${i + 1} error:`, error);
        continue;
      }
    }

    console.log(`Combined Google text length: ${allGoogleText.length} characters`);

    if (!allGoogleText || allGoogleText.length < 100) {
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

    // Use Claude AI to extract company names
    console.log('Calling Claude AI to extract company names...');
    
const aiPrompt = `You are analyzing search results to find UK-based competitors to ${companyName}.

Here is text from Google search results:

${allGoogleText}

Extract ONLY the company/brand names that are competitors or similar companies to ${companyName}.

CRITICAL UK-BASED RULES (VERY STRICT):
1. Return ONLY company names, nothing else
2. Exclude "${companyName}" itself from the results
3. ONLY include companies that UK FX brokers would actually target:
   - Must operate PRIMARILY in the UK market with significant UK presence
   - Must have UK headquarters OR substantial UK operations (not just a sales office)
   - UK brokers need to be able to call them and do business in the UK
   
4. STRICT EXCLUSIONS - DO NOT include:
   - International parent companies (e.g., Deutsche Telekom, AT&T, Telenor, NTT, Tata)
   - Foreign companies that only have small UK subsidiaries
   - Companies headquartered outside UK unless they have MAJOR UK operations
   - US, European, or Asian companies (even if they operate in UK)
   
5. GOOD EXAMPLES to include:
   - UK-headquartered companies: ASOS, Tesco, Sainsbury's, BT Group, Sky, Barclays
   - Major UK operations with significant presence: Aldi UK, Lidl UK (have UK headquarters for UK ops)
   
6. BAD EXAMPLES to EXCLUDE:
   - Deutsche Telekom (German, even though owns EE)
   - AT&T (American)
   - Telenor (Norwegian)
   - Telefonica (Spanish, even though owns O2)
   - NTT Communications (Japanese)
   - Tata Communications (Indian)
   - Any company where the parent is foreign and UK is just one market
   
7. ONLY include companies in the SAME industry/sector as ${companyName}:
   - If ${companyName} is fashion retail → only fashion retailers
   - If ${companyName} is telecom → only telecom companies
   - If ${companyName} is supermarket → only supermarkets
   - If ${companyName} is bank → only banks
   - EXCLUDE companies from different industries
   
8. When in doubt, EXCLUDE the company (be very conservative)

9. Remove duplicates (e.g., "Sainsbury's" and "Sainsbury's PLC" → just "Sainsbury's")

10. Return as valid JSON array:
   [{"name": "Company Name", "isSubsidiary": true/false}]
   - isSubsidiary = true: International company with MAJOR UK operations (e.g., Aldi UK, Lidl UK)
   - isSubsidiary = false: UK-headquartered company
   
11. Maximum 5 companies

Think: Would a UK FX broker actually call this company to offer FX services? If no, EXCLUDE it.

Your response (JSON array only):`;

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: aiPrompt
        }]
      })
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error('Claude API error:', claudeResponse.status, errorText);
      throw new Error(`Claude API error: ${claudeResponse.status}`);
    }

    const claudeData = await claudeResponse.json();
    console.log('Claude API response:', JSON.stringify(claudeData, null, 2));

    // Extract the text content from Claude's response
    const aiResponseText = claudeData.content[0].text.trim();
    console.log('AI extracted text:', aiResponseText);

    // Parse the JSON array from AI response
    let extractedCompanies: Array<{name: string, isSubsidiary: boolean}> = [];
    try {
      // Try to parse as JSON directly
      extractedCompanies = JSON.parse(aiResponseText);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      // Try to extract JSON array from text
      const jsonMatch = aiResponseText.match(/\[.*\]/s);
      if (jsonMatch) {
        extractedCompanies = JSON.parse(jsonMatch[0]);
      } else {
        console.error('Could not find JSON array in response');
        extractedCompanies = [];
      }
    }

    console.log('Extracted companies from AI:', extractedCompanies);

    if (!Array.isArray(extractedCompanies) || extractedCompanies.length === 0) {
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

    // Filter out the searched company (case-insensitive) and excluded companies
    const searchedCompanyLower = companyName.toLowerCase().trim();
    const excludeLower = excludeCompanies.map(c => c.toLowerCase().trim());
    
    const filteredCompanies = extractedCompanies
      .filter((company: {name: string, isSubsidiary: boolean}) => {
        const companyLower = company.name.toLowerCase().trim();
        // Exclude searched company
        if (companyLower === searchedCompanyLower || 
            companyLower.includes(searchedCompanyLower) ||
            searchedCompanyLower.includes(companyLower)) {
          return false;
        }
        // Exclude companies in exclusion list
        if (excludeLower.includes(companyLower)) {
          return false;
        }
        // Remove empty/single char
        return company.name && company.name.length > 1;
      });

    console.log('Filtered companies:', filteredCompanies);

    // Format results
    const similarCompanies = filteredCompanies.slice(0, limit).map((company: {name: string, isSubsidiary: boolean}) => ({
      name: company.name,
      industry: 'Similar Business',
      location: 'UK',
      size: 'Large',
      reasoning: 'Found by Spread Checker',
      isSubsidiary: company.isSubsidiary
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
