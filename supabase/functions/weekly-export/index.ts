/// <reference types="https://deno.land/x/types/index.d.ts" />
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

// Function to refresh Salesforce token if expired
async function refreshSalesforceToken(supabase: any, sfConnection: any) {
  const refreshResponse = await fetch('https://login.salesforce.com/services/oauth2/token', {
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
  });

  if (!refreshResponse.ok) {
    throw new Error('Failed to refresh token');
  }

  const newTokens = await refreshResponse.json();
  
  // Update the stored tokens
  await supabase
    .from('salesforce_connections')
    .update({
      access_token: newTokens.access_token,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sfConnection.id);

  return newTokens.access_token;
}

async function postToSalesforce(sfConnection: any, messageText: string, supabase: any) {
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
  };

  // Try to post to Salesforce
  let salesforceResponse = await fetch(
    `${sfConnection.instance_url}/services/data/v59.0/chatter/feed-elements`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sfConnection.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chatterPost)
    }
  );

  // If token expired, refresh and retry
  if (!salesforceResponse.ok) {
    const errorText = await salesforceResponse.text();
    if (errorText.includes('INVALID_SESSION_ID') || errorText.includes('Session expired') || salesforceResponse.status === 401) {
      console.log('Token expired, refreshing...');
      const newAccessToken = await refreshSalesforceToken(supabase, sfConnection);
      
      // Retry with new token
      salesforceResponse = await fetch(
        `${sfConnection.instance_url}/services/data/v59.0/chatter/feed-elements`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${newAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(chatterPost)
        }
      );
      
      if (!salesforceResponse.ok) {
        const error = await salesforceResponse.text();
        throw new Error(`Salesforce API error after refresh: ${error}`);
      }
    } else {
      throw new Error(`Salesforce API error: ${errorText}`);
    }
  }

  return salesforceResponse.json();
}

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Get all active export schedules
  const { data: schedules } = await supabase
    .from('export_schedules')
    .select('*')
    .eq('is_active', true);

  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();

  for (const schedule of schedules || []) {
    if (schedule.day_of_week === currentDay && schedule.hour === currentHour) {
      try {
        // Get Salesforce connection for this company
        const { data: sfConnection } = await supabase
          .from('salesforce_connections')
          .select('*')
          .eq('company_id', schedule.company_id)
          .single();

        if (!sfConnection) {
          console.error(`No Salesforce connection found for company ${schedule.company_id}`);
          continue;
        }

        // Generate export for this company - last 7 days
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - 7);
        
        // Get all calculations from calculations table
        const { data: calculations } = await supabase
          .from('activity_logs')
          .select('*')
          .eq('company_id', schedule.company_id)
          .gte('created_at', weekStart.toISOString())
          .lte('created_at', now.toISOString())
          .order('created_at', { ascending: false });

        if (!calculations || calculations.length === 0) {
          console.log(`No calculations found for company ${schedule.company_id} in the last week`);
          
          // Still post a message saying no calculations
          const messageText = `📊 SpreadChecker Weekly Export - ${now.toLocaleDateString('en-GB')}\n\n` +
            `Period: ${weekStart.toLocaleDateString('en-GB')} - ${now.toLocaleDateString('en-GB')}\n\n` +
            `No calculations recorded this week.\n\n` +
            `Encourage your team to use SpreadChecker to track all FX calculations and identify savings opportunities.`;

          await postToSalesforce(sfConnection, messageText, supabase);
        } else {
          // Format the data for Salesforce
          let messageText = `📊 SpreadChecker Weekly Export - ${now.toLocaleDateString('en-GB')}\n\n`
          messageText += `Period: ${weekStart.toLocaleDateString('en-GB')} - ${now.toLocaleDateString('en-GB')}\n`
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
          const userIdsToFetch = Object.keys(userCalculations)
          const { data: users } = await supabase
            .from('user_profiles')
            .select('id, full_name, email')
            .in('id', userIdsToFetch)

          const userMap = users?.reduce((acc: any, user) => {
            acc[user.id] = user.full_name || user.email
            return acc
          }, {}) || {}

          // Format each user's calculations with all the detailed fields
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
              
              // Format using abbreviations with all the new fields
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

          // Truncate if too long for Salesforce (max 10,000 characters)
          if (messageText.length > 9900) {
            messageText = messageText.substring(0, 9900) + '\n\n[Message truncated - view full details in SpreadChecker]';
          }

          await postToSalesforce(sfConnection, messageText, supabase);
        }

        // Update last_run timestamp
        await supabase
          .from('export_schedules')
          .update({ 
            last_run: now.toISOString(),
            updated_at: now.toISOString()
          })
          .eq('id', schedule.id);

        console.log(`Successfully exported data for company ${schedule.company_id}`);
      } catch (error) {
        console.error(`Error processing schedule for company ${schedule.company_id}:`, error);
      }
    }
  }

  return new Response('Weekly exports completed', { status: 200 });
});