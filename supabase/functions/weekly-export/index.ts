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
      last_sync: new Date().toISOString(),
    })
    .eq('company_id', sfConnection.company_id);

  return newTokens.access_token;
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
        
        // Get all calculations from calculations table (not activity_logs)
        const { data: calculations } = await supabase
          .from('calculations')
          .select('*, user_profiles!inner(full_name, email)')
          .eq('company_id', schedule.company_id)
          .gte('created_at', weekStart.toISOString())
          .lte('created_at', now.toISOString())
          .order('created_at', { ascending: false });

        if (!calculations || calculations.length === 0) {
          console.log(`No calculations found for company ${schedule.company_id} in the last week`);
          
          // Still post a message saying no calculations
          const messageText = `📊 SpreadChecker Export (${weekStart.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} - ${now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })})

No calculations recorded this week.

Encourage your team to use SpreadChecker to track all FX calculations and identify savings opportunities.`;

          await postToSalesforce(sfConnection, messageText, supabase);
        } else {
          // Calculate team statistics
          const totalTradeValue = calculations.reduce((sum, calc) => {
            const data = calc.calculation_data || {};
            return sum + (data.trade_amount || 0);
          }, 0);
          const avgTradeValue = totalTradeValue / calculations.length;

          // Group calculations by user
          const userGroups: Record<string, any[]> = {};
          calculations.forEach(calc => {
            const userName = calc.user_profiles?.full_name || calc.user_profiles?.email || 'Unknown';
            if (!userGroups[userName]) {
              userGroups[userName] = [];
            }
            userGroups[userName].push(calc);
          });

          // Build the detailed message
          let messageText = `📊 SpreadChecker Export (${weekStart.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} - ${now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })})

Avg Trade Value: £${Math.round(avgTradeValue).toLocaleString()}
Amt Calculations: ${calculations.length}

`;

          // Add each user's calculations
          for (const [userName, userCalcs] of Object.entries(userGroups)) {
            messageText += `${userName}\n`;
            
            userCalcs.forEach((calc, index) => {
              const data = calc.calculation_data || {};
              const timestamp = new Date(calc.created_at).toLocaleString('en-GB', { 
                hour: '2-digit', 
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit'
              });
              
              // Format calculation details
              messageText += `${index + 1}. [${timestamp}] Calculation\n`;
              messageText += `CP ${data.currency_pair} | YR ${data.your_rate?.toFixed(4)} | CR ${data.competitor_rate?.toFixed(4)} | CN ${data.client_name || 'N/A'} | CD ${new Date(data.comparison_date || calc.created_at).toLocaleDateString('en-GB')} | ATB £${(data.trade_amount || 0).toLocaleString()} | TPY ${data.trades_per_year || 0} | PA ${data.pips_added || 0}\n`;
              
              // Format results with emojis
              const costWithComp = data.cost_with_competitor?.toFixed(2) || '0';
              const costWithUs = data.cost_with_us?.toFixed(2) || '0';
              const savingsPerTrade = data.savings_per_trade?.toFixed(2) || '0';
              const annualSavings = data.annual_savings?.toFixed(2) || '0';
              const percentSavings = data.percentage_savings?.toFixed(2) || '0';
              
              messageText += `Results\n`;
              messageText += `PD ${data.price_difference || '0'} | Pips ${data.difference_in_pips || 0} | `;
              messageText += `❌ CWC £${costWithComp} | ✅ CWU £${costWithUs} | `;
              messageText += `✅ SVT £${savingsPerTrade} | ✅ AS £${annualSavings} | ✅ PS ${percentSavings}%\n\n`;
            });
          }

          // Add footer
          messageText += `\nKeep up the great work! View detailed analytics in SpreadChecker dashboard.`;

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
  if (!salesforceResponse.ok && salesforceResponse.status === 401) {
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
  }

  if (!salesforceResponse.ok) {
    const error = await salesforceResponse.text();
    throw new Error(`Salesforce API error: ${error}`);
  }

  return salesforceResponse.json();
}