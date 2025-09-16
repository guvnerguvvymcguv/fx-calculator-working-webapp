// supabase/functions/salesforce-export-test/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function refreshSalesforceToken(sfConnection: any, supabase: any) {
  const refreshResponse = await fetch(
    'https://login.salesforce.com/services/oauth2/token',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: sfConnection.refresh_token,
        client_id: Deno.env.get('SALESFORCE_CLIENT_ID')!,
        client_secret: Deno.env.get('SALESFORCE_CLIENT_SECRET')!,
      }),
    }
  )

  if (!refreshResponse.ok) {
    throw new Error('Failed to refresh token')
  }

  const newTokens = await refreshResponse.json()
  
  // Update the stored tokens
  await supabase
    .from('salesforce_connections')
    .update({
      access_token: newTokens.access_token,
      updated_at: new Date().toISOString()
    })
    .eq('id', sfConnection.id)

  return newTokens.access_token
}

async function postToSalesforce(sfConnection: any, chatterPost: any, supabase: any) {
  let accessToken = sfConnection.access_token
  
  // First attempt
  let salesforceResponse = await fetch(
    `${sfConnection.instance_url}/services/data/v59.0/chatter/feed-elements`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chatterPost)
    }
  )

  // If token expired, refresh and retry
  if (!salesforceResponse.ok) {
    const errorText = await salesforceResponse.text()
    if (errorText.includes('INVALID_SESSION_ID') || errorText.includes('Session expired')) {
      console.log('Token expired, refreshing...')
      accessToken = await refreshSalesforceToken(sfConnection, supabase)
      
      // Retry with new token
      salesforceResponse = await fetch(
        `${sfConnection.instance_url}/services/data/v59.0/chatter/feed-elements`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(chatterPost)
        }
      )
      
      if (!salesforceResponse.ok) {
        const error = await salesforceResponse.text()
        throw new Error(`Salesforce API error after refresh: ${error}`)
      }
    } else {
      throw new Error(`Salesforce API error: ${errorText}`)
    }
  }

  return salesforceResponse.json()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)
    
    if (!user) {
      throw new Error('User not authenticated')
    }

    // Get user's company and Salesforce connection
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    const { data: sfConnection } = await supabase
      .from('salesforce_connections')
      .select('*')
      .eq('company_id', profile!.company_id)
      .single()

    if (!sfConnection) {
      throw new Error('No Salesforce connection found')
    }

    // Create Chatter post with preview of new format
    const chatterPost = {
      body: {
        messageSegments: [
          {
            type: 'Text',
            text: `📊 SpreadChecker Test Connection Successful!

Your weekly exports will include detailed calculations in this format:

Example Calculation [09:45 16/09]:
CP GBP/USD | YR 1.2540 | CR 1.2530 | CN Test Corp | CD 16/09/2025 | ATB £500,000 | TPY 52 | PA 10
Results
PD +0.0010 | Pips 10 | ❌ CWC £398,882.68 | ✅ CWU £398,406.37 | ✅ SVT £476.31 | ✅ AS £24,768.12 | ✅ PS 0.12%

Weekly exports will be posted here automatically.
Manual exports can be triggered from your SpreadChecker dashboard.`
          }
        ]
      },
      feedElementType: 'FeedItem',
      subjectId: sfConnection.user_id
    }

    // Post to Salesforce with automatic retry on token expiration
    const result = await postToSalesforce(sfConnection, chatterPost, supabase)

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})