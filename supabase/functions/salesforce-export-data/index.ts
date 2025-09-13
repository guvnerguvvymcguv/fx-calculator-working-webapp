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
    const { userIds, dateRange } = await req.json()
    console.log('Received userIds:', userIds)
    console.log('Received dateRange:', dateRange)
    
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

    console.log('User profile company_id:', profile?.company_id)

    const { data: sfConnection } = await supabase
      .from('salesforce_connections')
      .select('*')
      .eq('company_id', profile!.company_id)
      .single()

    if (!sfConnection) {
      throw new Error('No Salesforce connection found')
    }

    // Query calculations for selected users and date range
    const { data: calculations, error: calcError } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('company_id', profile!.company_id)
      .in('user_id', userIds)
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end)
      .order('created_at', { ascending: false })

    console.log('Query error:', calcError)
    console.log('Calculations found:', calculations?.length || 0)
    console.log('Sample calculation:', calculations?.[0])

    if (!calculations || calculations.length === 0) {
      // Send a message even when no calculations found
      const messageText = `📊 SpreadChecker Export (${new Date(dateRange.start).toLocaleDateString('en-GB')} - ${new Date(dateRange.end).toLocaleDateString('en-GB')})

No calculations found for the selected period.

Please ensure your team has logged calculations during this time frame.`;

      const chatterPost = {
        body: {
          messageSegments: [{
            type: 'Text',
            text: messageText
          }]
        },
        feedElementType: 'FeedItem',
        subjectId: sfConnection.user_id
      }

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

      return new Response(
        JSON.stringify({ success: true, message: 'No calculations to export' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user names
    const { data: users } = await supabase
      .from('user_profiles')
      .select('id, full_name, email')
      .in('id', userIds)

    // Calculate summary statistics
    const totalCalculations = calculations.length
    const totalTradeValue = calculations.reduce((sum, calc) => sum + (parseFloat(calc.amount) || 0), 0)
    const avgTradeValue = totalTradeValue / totalCalculations
    const totalSavings = calculations.reduce((sum, calc) => sum + (parseFloat(calc.savings_per_trade) || 0), 0)

    // Group calculations by user
    const userStats = userIds.map(userId => {
      const userCalcs = calculations.filter(c => c.user_id === userId)
      const userData = users?.find(u => u.id === userId)
      const userSavings = userCalcs.reduce((sum, calc) => sum + (parseFloat(calc.savings_per_trade) || 0), 0)
      
      return {
        name: userData?.full_name || userData?.email || 'Unknown',
        calculations: userCalcs.length,
        savings: userSavings,
        avgTrade: userCalcs.length > 0 ? userCalcs.reduce((sum, calc) => sum + (parseFloat(calc.amount) || 0), 0) / userCalcs.length : 0
      }
    }).filter(u => u.calculations > 0).sort((a, b) => b.calculations - a.calculations)

    // Format date range for display
    const startDate = new Date(dateRange.start).toLocaleDateString('en-GB')
    const endDate = new Date(dateRange.end).toLocaleDateString('en-GB')

    // Create Chatter post with actual data
    const messageText = `📊 SpreadChecker Export (${startDate} - ${endDate})

TEAM PERFORMANCE
- Total calculations: ${totalCalculations.toLocaleString()}
- Average trade value: £${Math.round(avgTradeValue).toLocaleString()}
- Total savings identified: £${Math.round(totalSavings).toLocaleString()}

TOP PERFORMERS
${userStats.slice(0, 5).map((user, index) => 
  `${index + 1}. ${user.name}: ${user.calculations} calcs | £${Math.round(user.savings).toLocaleString()} savings | Avg: £${Math.round(user.avgTrade).toLocaleString()}`
).join('\n')}

CURRENCY BREAKDOWN
${Object.entries(
  calculations.reduce((acc, calc) => {
    const pair = calc.currency_pair || 'Unknown'
    acc[pair] = (acc[pair] || 0) + 1
    return acc
  }, {} as Record<string, number>)
)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([pair, count]) => `• ${pair}: ${count} calculations (${Math.round(count / totalCalculations * 100)}%)`)
  .join('\n')}

View detailed calculations in SpreadChecker dashboard`

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
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})