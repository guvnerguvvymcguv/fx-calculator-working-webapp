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
  confidence_score: number;
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
    const location = sourceCompanyData.registered_office_address?.region || 
                     sourceCompanyData.registered_office_address?.locality || 
                     'UK';
    
    // Determine company size indicators
    const isPublic = sourceCompanyData.company_type?.includes('plc') || 
                     sourceCompanyData.company_type?.includes('public');
    const companyAge = sourceCompanyData.date_of_creation ? 
                       new Date().getFullYear() - new Date(sourceCompanyData.date_of_creation).getFullYear() : 0;

    // Step 3: Search for companies with same SIC codes and similar characteristics
    const similarCompaniesRaw = await findSimilarCompanies(sicCodes, location, isPublic, companyAge);

    // Step 4: Use AI to filter and rank the results
    const similarCompanies = await rankCompaniesWithAI(
      companyName,
      sourceCompanyData,
      similarCompaniesRaw
    );

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
      reasoning: company.reasoning,
      confidence_score: company.confidence_score
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
      similarCompanies: similarCompanies
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
    console.log('Top result:', company.company_name, company.company_number);

    // Get detailed company info including SIC codes
    const detailUrl = `https://api.company-information.service.gov.uk/company/${company.company_number}`;
    console.log('Fetching company details:', detailUrl);
    
    const detailResponse = await fetch(detailUrl, {
      headers: {
        'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`
      }
    });

    if (!detailResponse.ok) {
      console.log('Could not fetch details, using basic info');
      return company;
    }

    const detailData = await detailResponse.json();
    console.log('Company details:', detailData);
    
    return {
      ...company,
      sic_codes: detailData.sic_codes || [],
      registered_office_address: detailData.registered_office_address || company.registered_office_address
    };

  } catch (error) {
    console.error('Error searching Companies House:', error);
    return null;
  }
}

// Find companies with similar SIC codes in the same region
async function findSimilarCompanies(
  sicCodes: string[],
  _location: string,
  isPublicCompany: boolean,
  sourceCompanyAge: number
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
    console.log('Source company characteristics:', { isPublicCompany, sourceCompanyAge });
    
    // Try searching by SIC code number directly
    const searchUrl = `https://api.company-information.service.gov.uk/advanced-search/companies?sic_codes=${primarySicCode}&size=100`;
    
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
      const filtered = filterBySize(fallbackData.items || [], isPublicCompany, sourceCompanyAge);
      console.log('Results after size filtering:', filtered.length);
      return filtered;
    }

    const data = await response.json();
    console.log('Advanced search results count before filtering:', data.items?.length || 0);
    
    // Filter results by size
    const filtered = filterBySize(data.items || [], isPublicCompany, sourceCompanyAge);
    console.log('Results after size filtering:', filtered.length);
    return filtered;

  } catch (error) {
    console.error('Error finding similar companies:', error);
    return [];
  }
}

// Filter companies by size indicators
function filterBySize(
  companies: CompanySearchResult[],
  isPublicCompany: boolean,
  sourceCompanyAge: number
): CompanySearchResult[] {
  return companies.filter(company => {
    // Filter out dissolved companies
    if (company.company_status === 'dissolved' || company.company_status === 'liquidation') {
      return false;
    }

    // If source is public, prioritize public companies or larger private companies
    if (isPublicCompany) {
      const isPublic = company.company_type?.includes('plc') || 
                       company.company_type?.includes('public');
      
      // Accept public companies, or private limited companies that are likely large
      if (!isPublic && !company.company_type?.includes('private-limited-guarant')) {
        // For private companies, only accept if they're well-established
        const companyAge = company.date_of_creation ? 
                          new Date().getFullYear() - new Date(company.date_of_creation).getFullYear() : 0;
        
        // Only include mature companies (10+ years) if source is public
        if (companyAge < 10) {
          return false;
        }
      }
    } else {
      // Source is private - filter out very small/new companies
      const companyAge = company.date_of_creation ? 
                        new Date().getFullYear() - new Date(company.date_of_creation).getFullYear() : 0;
      
      // Prefer companies within ±50% of source company age
      const minAge = Math.max(3, sourceCompanyAge * 0.5);
      const maxAge = sourceCompanyAge * 1.5;
      
      if (companyAge < minAge || companyAge > maxAge) {
        return false;
      }
    }

    return true;
  });
}

// Use AI to rank and filter companies based on similarity
async function rankCompaniesWithAI(
  sourceCompanyName: string,
  sourceCompany: CompanySearchResult,
  candidateCompanies: CompanySearchResult[]
): Promise<SimilarCompany[]> {
  try {
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!anthropicApiKey) {
      // Fallback: return basic list without AI ranking but with actual company data
      console.log('No Anthropic API key, using fallback ranking');
      return candidateCompanies.slice(0, 8).map((company, index) => ({
        name: company.company_name || 'Unknown',
        industry: company.sic_codes?.join(', ') || 'Unknown industry',
        location: company.registered_office_address?.locality || 
                  company.registered_office_address?.region || 
                  'UK',
        size: company.company_type?.includes('private-limited') ? 'Small/Medium' : 'Similar',
        reasoning: `Same industry sector as ${sourceCompanyName}`,
        confidence_score: 0.7 - (index * 0.05)
      }));
    }

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
    "reasoning": "One sentence why they're similar",
    "confidence_score": 0.85
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

    if (!response.ok) {
      console.error('Claude API error:', response.status);
      throw new Error('AI ranking failed');
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
    // Fallback to basic ranking
    return candidateCompanies.slice(0, 5).map((company, index) => ({
      name: company.company_name,
      industry: company.sic_codes?.join(', ') || 'Unknown',
      location: company.registered_office_address?.locality || 
                company.registered_office_address?.region || 'UK',
      size: 'Similar',
      reasoning: 'Same industry classification',
      confidence_score: 0.7 - (index * 0.1)
    }));
  }
}
