// supabase/functions/salesforce-export-test/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Create Chatter post
    const chatterPost = {
      body: {
        messageSegments: [
          {
            type: 'Text',
            text: '📊 SpreadChecker Test Post\n\nThis is a test connection from SpreadChecker. Your weekly calculation summaries will appear here.\n\nTest calculation:\n• Client: Test Company\n• Currency: GBP/USD\n• Our Rate: 1.2540\n• Competitor: 1.2530\n• Potential Savings: £520\n• Broker: Test User'
          }
        ]
      },
      feedElementType: 'FeedItem',
      subjectId: sfConnection.user_id // Post to the user's feed
    }

    // Post to Salesforce Chatter
    const salesforceResponse = await fetch(
      `${sfConnection.instance_url}/services/data/v59.0/chatter/feed-elements`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sfConnection.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chatterPost)
      }
    )

    if (!salesforceResponse.ok) {
      const error = await salesforceResponse.text()
      throw new Error(`Salesforce API error: ${error}`)
    }

    const result = await salesforceResponse.json()

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