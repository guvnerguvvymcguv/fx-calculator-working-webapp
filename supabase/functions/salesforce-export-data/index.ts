// supabase/functions/salesforce-export-data/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function refreshSalesforceToken(sfConnection: any, supabase: any) {
  console.log('🔄 Attempting to refresh Salesforce token...')
  
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
    const errorText = await refreshResponse.text()
    console.error('❌ Token refresh failed:', errorText)
    throw new Error('Failed to refresh token')
  }

  const newTokens = await refreshResponse.json()
  console.log('✅ Token refreshed successfully')
  
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
  
  console.log('📤 Posting to Salesforce Chatter...')
  console.log('Instance URL:', sfConnection.instance_url)
  
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

  console.log('Salesforce response status:', salesforceResponse.status)

  // If token expired, refresh and retry
  if (!salesforceResponse.ok) {
    const errorText = await salesforceResponse.text()
    console.error('❌ Salesforce API error:', errorText)
    
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
        console.error('❌ Salesforce API error after refresh:', error)
        throw new Error(`Salesforce API error after refresh: ${error}`)
      }
    } else {
      throw new Error(`Salesforce API error: ${errorText}`)
    }
  }

  console.log('✅ Successfully posted to Salesforce')
  return salesforceResponse.json()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('🚀 Export function started')

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('✅ Supabase client initialized')

    // Get request body
    const body = await req.json()
    const { userIds, dateRange, companyId } = body
    
    console.log('📋 Request data:', {
      userIds,
      dateRange,
      companyId
    })

    if (!userIds || !dateRange || !companyId) {
      console.error('❌ Missing required parameters')
      throw new Error('Missing required parameters: userIds, dateRange, or companyId')
    }

    // Check if company account is locked OR subscription is inactive
    console.log('🔍 Checking company status...')
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('account_locked, subscription_active')
      .eq('id', companyId)
      .single()

    if (companyError) {
      console.error('❌ Company fetch error:', companyError)
      throw new Error(`Company fetch error: ${companyError.message}`)
    }

    console.log('Company status:', company)

    if (company?.account_locked || !company?.subscription_active) {
      console.warn('⚠️ Account locked or subscription inactive')
      return new Response(
        JSON.stringify({ error: 'Account locked or subscription inactive. Please upgrade to continue.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the Salesforce connection using companyId directly
    console.log('🔍 Fetching Salesforce connection...')
    const { data: sfConnection, error: sfError } = await supabase
      .from('salesforce_connections')
      .select('*')
      .eq('company_id', companyId)
      .single()

    if (sfError) {
      console.error('❌ Salesforce connection fetch error:', sfError)
      throw new Error(`Salesforce connection error: ${sfError.message}`)
    }

    if (!sfConnection) {
      console.error('❌ No Salesforce connection found for company:', companyId)
      throw new Error('No Salesforce connection found')
    }

    console.log('✅ Salesforce connection found')

    // Fetch calculations for the selected users and date range
    console.log('🔍 Fetching calculations...')
    const { data: calculations, error: calcError } = await supabase
      .from('activity_logs')
      .select('*')
      .in('user_id', userIds)
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end)
      .order('created_at', { ascending: false })

    if (calcError) {
      console.error('❌ Calculations fetch error:', calcError)
      throw new Error(`Calculations fetch error: ${calcError.message}`)
    }

    console.log(`Found ${calculations?.length || 0} calculations`)

    if (!calculations || calculations.length === 0) {
      console.warn('⚠️ No calculations found for selected period')
      return new Response(
        JSON.stringify({ message: 'No calculations found for selected period' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Format the data for Salesforce
    console.log('📝 Formatting data for Salesforce...')
    let messageText = `📊 SpreadChecker Export - ${new Date().toLocaleDateString('en-GB')}\n\n`
    messageText += `Period: ${new Date(dateRange.start).toLocaleDateString('en-GB')} - ${new Date(dateRange.end).toLocaleDateString('en-GB')}\n`
    messageText += `Total Calculations: ${calculations.length}\n\n`

    // Group calculations by user
    const userCalculations = calculations.reduce((acc: any, calc) => {
      if (!acc[calc.user_id]) {
        acc[calc.user_id] = []
      }
      acc[calc.user_id].push(calc)
      return acc
    }, {})

    // Fetch user names
    console.log('🔍 Fetching user names...')
    const userIdsToFetch = Object.keys(userCalculations)
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('id, full_name, email')
      .in('id', userIdsToFetch)

    if (usersError) {
      console.error('❌ Users fetch error:', usersError)
      throw new Error(`Users fetch error: ${usersError.message}`)
    }

    console.log(`Found ${users?.length || 0} users`)

    const userMap = users?.reduce((acc: any, user) => {
      acc[user.id] = user.full_name || user.email
      return acc
    }, {}) || {}

    // Format each user's calculations
    for (const [userId, userCalcs] of Object.entries(userCalculations)) {
      const userName = userMap[userId] || 'Unknown User'
      messageText += `\n👤 ${userName}\n`
      messageText += `─────────────────\n`
      
      for (const calc of userCalcs as any[]) {
        const time = new Date(calc.created_at).toLocaleTimeString('en-GB', { 
          hour: '2-digit', 
          minute: '2-digit' 
        })
        const date = new Date(calc.created_at).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit'
        })
        
        // Format using abbreviations
        messageText += `\n[${time} ${date}]\n`
        messageText += `CP ${calc.currency_pair} | YR ${calc.your_rate} | CR ${calc.competitor_rate} | `
        messageText += `CN ${calc.client_name || 'N/A'} | CD ${calc.comparison_date || date} | `
        messageText += `ATB £${calc.amount_to_buy || 0} | TPY ${calc.trades_per_year || 0} | PA ${calc.payment_amount || 0}\n`
        messageText += `Results\n`
        messageText += `PD ${calc.price_difference >= 0 ? '+' : ''}${calc.price_difference || 0} | `
        messageText += `Pips ${calc.pips_difference || 0} | `
        messageText += `❌ CWC £${calc.cost_with_competitor?.toFixed(2) || 0} | `
        messageText += `✅ CWU £${calc.cost_with_us?.toFixed(2) || 0} | `
        messageText += `✅ SVT £${calc.savings_per_trade?.toFixed(2) || 0} | `
        messageText += `✅ AS £${calc.annual_savings?.toFixed(2) || 0} | `
        messageText += `✅ PS ${calc.percentage_savings?.toFixed(2) || 0}%\n`
      }
    }

    console.log('Message length:', messageText.length, 'characters')

    // Create Chatter post
    const chatterPost = {
      body: {
        messageSegments: [
          {
            type: 'Text',
            text: messageText
          }
        ]
      },
      feedElementType: 'FeedItem',
      subjectId: sfConnection.user_id
    }

    console.log('Chatter post created with subjectId:', sfConnection.user_id)

    // Post to Salesforce with automatic retry on token expiration
    const result = await postToSalesforce(sfConnection, chatterPost, supabase)

    console.log('✅ Export completed successfully')

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ Export error:', error)
    console.error('Error stack:', error.stack)
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error occurred' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})