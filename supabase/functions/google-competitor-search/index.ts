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

    const { companyName, limit = 10 } = await req.json();

    console.log('Searching for competitors of:', companyName);

    // Multiple search strategies to maximize results
    const searchStrategies = [
      `${companyName} competitors UK`,
      `${companyName} similar companies UK`,
      `${companyName} alternative brands UK`,
      `companies like ${companyName} UK`,
      `${companyName} vs competitors UK`,
      `best alternatives to ${companyName} UK`,
      `${companyName} competitor analysis UK`,
      `brands similar to ${companyName}`,
      `${companyName} rivals UK market`,
      `top competitors ${companyName} UK`
    ];

    let allGoogleText = '';
    
    // Run multiple searches and combine results
    for (let i = 0; i < searchStrategies.length; i++) {
      const searchQuery = searchStrategies[i];
      const googleSearchUrl = `https://customsearch.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleSearchEngineId}&q=${encodeURIComponent(searchQuery)}&num=10`;
      
      console.log(`Search ${i + 1}/10: ${searchQuery}`);
      
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

        // Small delay to avoid rate limiting
        if (i < searchStrategies.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
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
    
    const aiPrompt = `You are analyzing search results about competitors to ${companyName}.

Here is text from Google search results:

${allGoogleText}

Extract ONLY the company/brand names that are competitors or similar companies to ${companyName}.

CRITICAL RULES:
1. Return ONLY company names, nothing else
2. Exclude "${companyName}" itself from the results
3. ONLY include companies that are UK-BASED (headquartered in the UK):
   - Company must have its main headquarters in the UK
   - UK subsidiaries of international companies are ALLOWED if they have UK offices (e.g., "Aldi UK" is allowed because Aldi has UK headquarters for UK operations)
   - Companies that just ship to UK or have UK customers but NO UK headquarters/offices should be EXCLUDED
   - Examples of UK-based companies: ASOS (UK HQ), Boohoo (UK HQ), Sainsbury's (UK HQ), Barclays (UK HQ)
   - Examples to EXCLUDE: Shein (China HQ), Farfetch (Portugal/US HQ), companies that only sell online to UK
4. ONLY include companies in the SAME industry/sector as ${companyName}:
   - If ${companyName} is fashion retail (e.g., ASOS), only include other fashion retailers
   - If ${companyName} is a supermarket (e.g., Tesco), only include other supermarkets
   - If ${companyName} is a bank (e.g., Barclays), only include other banks
   - EXCLUDE companies from different industries even if they're mentioned together
   - Example: When searching for ASOS (fashion), EXCLUDE Sainsbury's (supermarket) even if both mentioned
5. If a company moved its headquarters OUT of the UK, EXCLUDE it
6. If you're unsure whether a company has UK headquarters, EXCLUDE it (be conservative)
7. Remove duplicates (e.g., "Sainsbury's" and "Sainsbury's PLC" should just be "Sainsbury's")
8. Return as a valid JSON array only, no other text or explanation
9. Maximum 15 companies

Example response format:
["Company A", "Company B", "Company C"]

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
    let extractedCompanies: string[] = [];
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

    // Filter out the searched company (case-insensitive) and clean up
    const searchedCompanyLower = companyName.toLowerCase().trim();
    const filteredCompanies = extractedCompanies
      .filter((company: string) => {
        const companyLower = company.toLowerCase().trim();
        return companyLower !== searchedCompanyLower && 
               !companyLower.includes(searchedCompanyLower) &&
               !searchedCompanyLower.includes(companyLower);
      })
      .filter((company: string) => company && company.length > 1); // Remove empty/single char

    console.log('Filtered companies:', filteredCompanies);

    // Format results
    const similarCompanies = filteredCompanies.slice(0, limit).map((name: string) => ({
      name: name,
      industry: 'Similar Business',
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
