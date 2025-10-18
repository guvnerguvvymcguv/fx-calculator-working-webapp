import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

interface CompanySearchResult {
  company_name: string;
  company_number: string;
  registered_office_address?: {
    locality?: string;
    region?: string;
    postal_code?: string;
    country?: string;
  };
  company_status?: string;
  company_type?: string;
  sic_codes?: string[];
  date_of_creation?: string;
}

interface SimilarCompany {
  name: string;
  industry: string;
  location: string;
  size: string;
  reasoning: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { companyName, userId, companyId } = req.body;

    if (!companyName || !userId || !companyId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user belongs to company
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('company_id, role_type')
      .eq('id', userId)
      .single();

    if (profileError || !userProfile || userProfile.company_id !== companyId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    console.log(`Searching for companies similar to: ${companyName}`);

    // Step 1: Search Companies House API for the input company
    const sourceCompanyData = await searchCompaniesHouse(companyName);
    
    if (!sourceCompanyData) {
      return res.status(404).json({ error: 'Company not found' });
    }

    console.log('Source company found:', sourceCompanyData.company_name);

    // Step 2: Get industry codes and search for similar companies
    const sicCodes = sourceCompanyData.sic_codes || [];
    
    // Check if source company has valid SIC codes
    const invalidSicCodes = ['70100', '70101', '64200', '64201', '64202', '64203', '64209', '74990', '99999', '82990'];
    const hasValidSicCode = sicCodes.some(code => !invalidSicCodes.includes(code));
    
    if (!hasValidSicCode) {
      return res.status(400).json({ 
        error: 'Company not suitable for comparison',
        details: 'This company has dormant/holding company classification and cannot be used to find similar operating businesses. Please try searching for the main operating company instead.'
      });
    }
    const location = sourceCompanyData.registered_office_address?.region || 
                     sourceCompanyData.registered_office_address?.locality || 
                     'UK';
    
    // Determine company size indicators
    const isPublic = sourceCompanyData.company_type?.includes('plc') || 
                     sourceCompanyData.company_type?.includes('public') || false;
    const companyAge = sourceCompanyData.date_of_creation ? 
                       new Date().getFullYear() - new Date(sourceCompanyData.date_of_creation).getFullYear() : 0;
    
    // Get account type from source company (if available)
    const accountType = (sourceCompanyData as any).accounts?.last_accounts?.type;
    console.log('Source company account type:', accountType);

    // Step 3: Search for companies with same SIC codes and similar characteristics
    const similarCompaniesRaw = await findSimilarCompanies(sicCodes, location, isPublic, companyAge, accountType);

    console.log('Raw companies found:', similarCompaniesRaw.length);
    console.log('First 3 raw companies:', similarCompaniesRaw.slice(0, 3).map(c => c.company_name));

    // Step 4: Use AI to filter and rank the results
    const similarCompanies = await rankCompaniesWithAI(
      companyName,
      sourceCompanyData,
      similarCompaniesRaw
    );

    // If no companies found, return helpful message
    if (similarCompanies.length === 0) {
      return res.status(200).json({
        success: true,
        sourceCompany: {
          name: sourceCompanyData.company_name,
          location: location,
          industry: sicCodes.join(', ')
        },
        similarCompanies: [],
        message: 'No similar active companies found. This could be because the industry is very specialized or most companies with this classification are dissolved.'
      });
    }

    // Step 5: Save search to database
    await supabase.from('company_searches').insert({
      company_id: companyId,
      user_id: userId,
      search_query: companyName,
      results_count: similarCompanies.length
    });

    // Step 6: Save similar companies to database
    const companiesToInsert = similarCompanies.map(company => ({
      company_id: companyId,
      source_company_name: companyName,
      similar_company_name: company.name,
      industry: company.industry,
      company_size: company.size,
      location: company.location,
      reasoning: company.reasoning
    }));

    if (companiesToInsert.length > 0) {
      await supabase.from('similar_companies').insert(companiesToInsert);
    }

    return res.status(200).json({
      success: true,
      sourceCompany: {
        name: sourceCompanyData.company_name,
        location: location,
        industry: sicCodes.join(', ')
      },
      similarCompanies: similarCompanies,
      debug: {
        rawCompaniesFound: similarCompaniesRaw.length,
        afterFiltering: similarCompanies.length,
        sicCodes: sicCodes,
        isPublic: isPublic,
        companyAge: companyAge
      }
    });

  } catch (error) {
    console.error('Error finding similar companies:', error);
    return res.status(500).json({ 
      error: 'Failed to find similar companies',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Search Companies House API for a company by name
async function searchCompaniesHouse(companyName: string): Promise<CompanySearchResult | null> {
  try {
    const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
    
    if (!apiKey) {
      throw new Error('Companies House API key not configured');
    }

    // Companies House search endpoint - using correct URL structure
    const searchUrl = `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(companyName)}&items_per_page=5`;
    
    console.log('Searching Companies House:', searchUrl);
    
    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`
      }
    });

    console.log('Companies House search status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Companies House API error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    console.log('Companies House search results:', data);
    
    if (!data.items || data.items.length === 0) {
      console.log('No companies found for:', companyName);
      return null;
    }

    const company = data.items[0];
    
    // Skip dissolved companies in initial search results
    let activeCompany = company;
    if (company.company_status === 'dissolved' || company.company_status === 'liquidation') {
      console.log('Top result is dissolved, looking for active company...');
      // Find first active company in results
      activeCompany = data.items.find((c: any) => 
        c.company_status !== 'dissolved' && c.company_status !== 'liquidation'
      ) || company; // Fallback to first if none active
    }
    
    console.log('Top result:', activeCompany.company_name, activeCompany.company_number);

    // Get detailed company info including SIC codes
    const detailUrl = `https://api.company-information.service.gov.uk/company/${activeCompany.company_number}`;
    console.log('Fetching company details:', detailUrl);
    
    const detailResponse = await fetch(detailUrl, {
      headers: {
        'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`
      }
    });

    if (!detailResponse.ok) {
      console.log('Could not fetch details, using basic info');
      return activeCompany;
    }

    const detailData = await detailResponse.json();
    console.log('Company details:', detailData);
    
    // Check if this is a holding company - if so, try to find operating subsidiary
    if (detailData.sic_codes?.includes('70100')) {
      console.log('Found holding company, searching for operating subsidiary...');
      const subsidiary = await findOperatingSubsidiary(detailData.company_name, apiKey);
      if (subsidiary) {
        console.log('Found operating subsidiary:', subsidiary.company_name);
        return subsidiary;
      }
      // If no subsidiary found, the validation below will catch it
    }
    
    return {
      ...activeCompany,
      sic_codes: detailData.sic_codes || [],
      registered_office_address: detailData.registered_office_address || activeCompany.registered_office_address,
      accounts: detailData.accounts  // CRITICAL: Include accounts data for filtering
    };

  } catch (error) {
    console.error('Error searching Companies House:', error);
    return null;
  }
}

// Try to find operating subsidiary when source is a holding company
async function findOperatingSubsidiary(
  holdingCompanyName: string,
  apiKey: string
): Promise<CompanySearchResult | null> {
  try {
    // Common patterns for subsidiaries
    const searchTerms = [
      `${holdingCompanyName} Limited`,
      `${holdingCompanyName} Ltd`,
      `${holdingCompanyName} Stores`,
      `${holdingCompanyName} Retail`,
      `${holdingCompanyName} Services`,
      holdingCompanyName.replace(' PLC', ' Limited'),
      holdingCompanyName.replace(' plc', ' Limited')
    ];
    
    // Try each search term
    for (const term of searchTerms) {
      const searchUrl = `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(term)}&items_per_page=5`;
      
      const response = await fetch(searchUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`
        }
      });
      
      if (!response.ok) continue;
      
      const data = await response.json();
      
      // Look for first active company that's NOT a holding company
      for (const company of data.items || []) {
        if (company.company_status !== 'active') continue;
        
        // Get details to check SIC code
        const detailUrl = `https://api.company-information.service.gov.uk/company/${company.company_number}`;
        const detailResponse = await fetch(detailUrl, {
          headers: {
            'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`
          }
        });
        
        if (!detailResponse.ok) continue;
        
        const detailData = await detailResponse.json();
        
        // Check if this is NOT a holding company
        const invalidSicCodes = ['70100', '70101', '64200', '64201', '64202', '64203', '64209', '74990', '99999', '82990'];
        const hasOnlyInvalidSic = detailData.sic_codes?.every((code: string) => invalidSicCodes.includes(code));
        
        if (!hasOnlyInvalidSic && detailData.sic_codes?.length > 0) {
          console.log('Found valid subsidiary:', company.company_name, 'SIC:', detailData.sic_codes);
          return {
            ...company,
            sic_codes: detailData.sic_codes,
            registered_office_address: detailData.registered_office_address
          };
        }
      }
    }
    
    console.log('No valid subsidiary found');
    return null;
  } catch (error) {
    console.error('Error finding subsidiary:', error);
    return null;
  }
}

// Find companies with similar SIC codes in the same region
async function findSimilarCompanies(
  sicCodes: string[],
  _location: string,
  isPublicCompany: boolean,
  sourceCompanyAge: number,
  sourceAccountType?: string
): Promise<CompanySearchResult[]> {
  try {
    const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
    
    if (!apiKey || sicCodes.length === 0) {
      console.log('No API key or SIC codes available');
      return [];
    }

    // Search by primary SIC code - Companies House uses SIC code descriptions
    const primarySicCode = sicCodes[0];
    console.log('Searching for companies with SIC code:', primarySicCode);
    console.log('Source company characteristics:', { isPublicCompany, sourceCompanyAge, sourceAccountType });
    
    // Try searching by SIC code number directly - filter for active companies only
    const searchUrl = `https://api.company-information.service.gov.uk/advanced-search/companies?sic_codes=${primarySicCode}&company_status=active&size=100`;
    
    console.log('Advanced search URL:', searchUrl);
    
    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`
      }
    });

    console.log('Advanced search status:', response.status);

    if (!response.ok) {
      console.log('Advanced search failed, trying alternative method');
      
      // Fallback: search by industry keywords
      const fallbackUrl = `https://api.company-information.service.gov.uk/search/companies?q=${primarySicCode}&items_per_page=100`;
      console.log('Fallback search URL:', fallbackUrl);
      
      const fallbackResponse = await fetch(fallbackUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`
        }
      });
      
      if (!fallbackResponse.ok) {
        console.error('Fallback search also failed:', fallbackResponse.status);
        return [];
      }
      
      const fallbackData = await fallbackResponse.json();
      console.log('Fallback results count before filtering:', fallbackData.items?.length || 0);
      
      // Filter results by size
      const filtered = await filterBySize(fallbackData.items || [], isPublicCompany, sourceCompanyAge, sourceAccountType, apiKey);
      console.log('Results after size filtering:', filtered.length);
      return filtered;
    }

    const data = await response.json();
    console.log('Advanced search results count before filtering:', data.items?.length || 0);
    
    // Filter results by size
    const filtered = await filterBySize(data.items || [], isPublicCompany, sourceCompanyAge, sourceAccountType, apiKey);
    console.log('Results after size filtering:', filtered.length);
    return filtered;

  } catch (error) {
    console.error('Error finding similar companies:', error);
    return [];
  }
}

// Filter companies by size indicators and exclude holding companies
async function filterBySize(
  companies: CompanySearchResult[],
  isPublicCompany: boolean,
  sourceCompanyAge: number,
  sourceAccountType?: string,
  apiKey?: string
): Promise<CompanySearchResult[]> {
  console.log('Filtering', companies.length, 'companies. Source is public:', isPublicCompany, 'age:', sourceCompanyAge, 'account type:', sourceAccountType);
  
  // Log first company to see what data we have
  if (companies.length > 0) {
    console.log('Sample company data:', JSON.stringify(companies[0], null, 2));
  }
  
  // First pass: filter out obviously unsuitable companies without API calls
  const basicFiltered = companies.filter(company => {
    // Filter out dissolved companies
    if (company.company_status === 'dissolved' || company.company_status === 'liquidation') {
      console.log('Excluding (dissolved):', company.company_name);
      return false;
    }

    // CRITICAL: Filter out holding companies, head offices, and catch-all SIC codes
    const invalidSicCodes = [
      '70100', '70101',  // Head offices and holding companies  
      '64200', '64201', '64202', '64203', '64209',  // Financial holding companies
      '74990',  // Other professional activities (catch-all for defunct/misc companies)
      '99999',  // Dormant companies
      '82990'   // Other business support (often property/admin companies)
    ];
    const hasSicCodes = company.sic_codes && company.sic_codes.length > 0;
    
    if (hasSicCodes) {
      // Check if ALL SIC codes are invalid (exclude if yes)
      const allCodesAreInvalid = company.sic_codes!.every(code => 
        invalidSicCodes.includes(code)
      );
      
      if (allCodesAreInvalid) {
        console.log('Excluding invalid SIC company:', company.company_name, 'SIC:', company.sic_codes);
        return false;
      }
    }

    console.log('Accepting (basic filter):', company.company_name);
    return true;
  });
  
  console.log('After basic filtering:', basicFiltered.length, 'companies remain');
  
  // If no API key or source account type unknown, return basic filtered results
  if (!apiKey || !sourceAccountType) {
    console.log('Skipping account type filtering (no API key or source account type)');
    return basicFiltered.slice(0, 20); // Limit to 20 for Claude
  }
  
  // Second pass: fetch detailed account info for top 30 candidates (balance API calls vs accuracy)
  console.log('Fetching detailed account info for top 30 candidates...');
  const detailedFiltered: CompanySearchResult[] = [];
  
  for (const company of basicFiltered.slice(0, 30)) {
    try {
      const detailUrl = `https://api.company-information.service.gov.uk/company/${company.company_number}`;
      const detailResponse = await fetch(detailUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`
        }
      });
      
      if (!detailResponse.ok) {
        console.log('Could not fetch details for:', company.company_name);
        continue;
      }
      
      const detailData = await detailResponse.json();
      const accountType = detailData.accounts?.last_accounts?.type;
      
      console.log('Company:', company.company_name, 'Account type:', accountType);
      
      // Filter by account type based on source company
      const shouldInclude = shouldIncludeByAccountType(sourceAccountType, accountType, isPublicCompany, company.company_type);
      
      if (shouldInclude) {
        console.log('Including:', company.company_name, 'Account type:', accountType);
        detailedFiltered.push(company);
      } else {
        console.log('Excluding (size mismatch):', company.company_name, 'Account type:', accountType);
      }
      
      // Stop if we have enough results
      if (detailedFiltered.length >= 20) {
        break;
      }
    } catch (error) {
      console.error('Error fetching company details:', error);
      continue;
    }
  }
  
  console.log('After account type filtering:', detailedFiltered.length, 'companies remain');
  return detailedFiltered;
}

// Determine if a company should be included based on account types
function shouldIncludeByAccountType(
  sourceAccountType: string,
  candidateAccountType: string | undefined,
  sourceIsPublic: boolean,
  candidateType?: string
): boolean {
  // If candidate has no account data, exclude (likely dormant or too new)
  if (!candidateAccountType) {
    return false;
  }
  
  // Always exclude micro and small companies when source is group or full
  if ((sourceAccountType === 'group' || sourceAccountType === 'full') && 
      (candidateAccountType === 'micro' || candidateAccountType === 'small')) {
    return false;
  }
  
  // If source is public PLC with group accounts, prefer PLCs or companies with group accounts
  if (sourceIsPublic && sourceAccountType === 'group') {
    return candidateType === 'plc' || candidateAccountType === 'group';
  }
  
  // If source has group accounts (has subsidiaries), only include group or full
  if (sourceAccountType === 'group') {
    return candidateAccountType === 'group' || candidateAccountType === 'full';
  }
  
  // If source has full accounts, accept group or full
  if (sourceAccountType === 'full') {
    return candidateAccountType === 'group' || candidateAccountType === 'full';
  }
  
  // If source is small, accept small or full (but not micro)
  if (sourceAccountType === 'small') {
    return candidateAccountType === 'small' || candidateAccountType === 'full';
  }
  
  // Default: accept similar or larger account types
  return true;
}

// Use AI to rank and filter companies based on similarity
async function rankCompaniesWithAI(
  sourceCompanyName: string,
  sourceCompany: CompanySearchResult,
  candidateCompanies: CompanySearchResult[]
): Promise<SimilarCompany[]> {
  try {
    // If no candidates, return empty array immediately
    if (candidateCompanies.length === 0) {
      console.log('No candidate companies to rank');
      return [];
    }
    
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!anthropicApiKey) {
      // Fallback: return basic list without AI ranking but with actual company data
      console.log('No Anthropic API key, using fallback ranking');
      return candidateCompanies.slice(0, 8).map((company) => ({
        name: company.company_name || 'Unknown',
        industry: company.sic_codes?.join(', ') || 'Unknown industry',
        location: company.registered_office_address?.locality || 
                  company.registered_office_address?.region || 
                  'UK',
        size: company.company_type?.includes('plc') || company.company_type?.includes('public') ? 'Large (Public)' : 
              company.company_type?.includes('private-limited') ? 'Private' : 'Similar',
        reasoning: `Same industry sector as ${sourceCompanyName}`
      }));
    }
    
    console.log('Using Claude API for ranking with key:', anthropicApiKey ? `${anthropicApiKey.substring(0, 10)}...` : 'undefined');

    // Use Claude to intelligently rank companies
    const prompt = `You are analyzing companies similar to "${sourceCompanyName}".

Source Company:
- Name: ${sourceCompany.company_name}
- Location: ${sourceCompany.registered_office_address?.locality || sourceCompany.registered_office_address?.region || 'UK'}
- Industry Codes: ${sourceCompany.sic_codes?.join(', ') || 'Unknown'}

Candidate Companies:
${candidateCompanies.slice(0, 15).map((c, i) => `${i + 1}. ${c.company_name} (${c.registered_office_address?.locality || c.registered_office_address?.region || 'UK'})`).join('\n')}

Select the 5-8 most similar companies that would be good prospects for an FX broker. Focus on:
1. Same or similar industry
2. Similar geographic location (UK-based preferred)
3. Likely to have international trade needs (imports/exports)
4. Active companies (not dissolved)

Return ONLY a JSON array of objects with this exact structure:
[
  {
    "name": "Company Name",
    "industry": "Brief industry description",
    "location": "City/Region",
    "size": "Small/Medium/Large",
    "reasoning": "One sentence why they're similar"
  }
]

Be concise and return ONLY valid JSON.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    console.log('Claude API response status:', response.status);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Claude API error:', response.status, errorBody);
      throw new Error(`AI ranking failed with status ${response.status}`);
    }

    const data = await response.json();
    const textContent = data.content[0].text;
    
    // Extract JSON from response
    const jsonMatch = textContent.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No valid JSON in AI response');
    }

    const rankedCompanies = JSON.parse(jsonMatch[0]);
    
    return rankedCompanies;

  } catch (error) {
    console.error('Error ranking with AI:', error);
    // Fallback to basic ranking if we have candidates
    if (candidateCompanies.length === 0) {
      return [];
    }
    return candidateCompanies.slice(0, 5).map((company) => ({
      name: company.company_name,
      industry: company.sic_codes?.join(', ') || 'Unknown',
      location: company.registered_office_address?.locality || 
                company.registered_office_address?.region || 'UK',
      size: 'Similar',
      reasoning: 'Same industry classification'
    }));
  }
}
