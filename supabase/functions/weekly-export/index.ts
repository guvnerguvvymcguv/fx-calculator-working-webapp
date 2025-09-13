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
        
        // Get all calculations for the company in the last week
        const { data: calculations } = await supabase
          .from('activity_logs')
          .select('*')
          .eq('company_id', schedule.company_id)
          .eq('action_type', 'calculation')
          .gte('created_at', weekStart.toISOString())
          .lte('created_at', now.toISOString())
          .order('created_at', { ascending: false });

        if (!calculations || calculations.length === 0) {
          console.log(`No calculations found for company ${schedule.company_id} in the last week`);
          
          // Still post a message saying no calculations
          const messageText = `📊 SpreadChecker Weekly Export (${weekStart.toLocaleDateString('en-GB')} - ${now.toLocaleDateString('en-GB')})

No calculations recorded this week.

Encourage your team to use SpreadChecker to track all FX calculations and identify savings opportunities.`;

          await postToSalesforce(sfConnection, messageText, supabase);
        } else {
          // Get user details for the calculations
          const userIds = [...new Set(calculations.map(c => c.user_id))];
          const { data: users } = await supabase
            .from('user_profiles')
            .select('id, full_name, email')
            .in('id', userIds);

          // Calculate summary statistics
          const totalCalculations = calculations.length;
          const totalTradeValue = calculations.reduce((sum, calc) => sum + (parseFloat(calc.amount) || 0), 0);
          const avgTradeValue = totalTradeValue / totalCalculations;
          const totalSavings = calculations.reduce((sum, calc) => sum + (parseFloat(calc.savings_per_trade) || 0), 0);

          // Group calculations by user
          const userStats = userIds.map(userId => {
            const userCalcs = calculations.filter(c => c.user_id === userId);
            const userData = users?.find(u => u.id === userId);
            const userSavings = userCalcs.reduce((sum, calc) => sum + (parseFloat(calc.savings_per_trade) || 0), 0);
            
            return {
              name: userData?.full_name || userData?.email || 'Unknown',
              calculations: userCalcs.length,
              savings: userSavings,
              avgTrade: userCalcs.length > 0 ? userCalcs.reduce((sum, calc) => sum + (parseFloat(calc.amount) || 0), 0) / userCalcs.length : 0
            };
          }).filter(u => u.calculations > 0).sort((a, b) => b.calculations - a.calculations);

          // Create Chatter post with weekly data
          const messageText = `📊 SpreadChecker Weekly Export (${weekStart.toLocaleDateString('en-GB')} - ${now.toLocaleDateString('en-GB')})

WEEKLY PERFORMANCE SUMMARY
- Total calculations: ${totalCalculations.toLocaleString()}
- Average trade value: £${Math.round(avgTradeValue).toLocaleString()}
- Total savings identified: £${Math.round(totalSavings).toLocaleString()}

TOP PERFORMERS THIS WEEK
${userStats.slice(0, 5).map((user, index) => 
  `${index + 1}. ${user.name}: ${user.calculations} calcs | £${Math.round(user.savings).toLocaleString()} savings | Avg: £${Math.round(user.avgTrade).toLocaleString()}`
).join('\n')}

CURRENCY BREAKDOWN
${Object.entries(
  calculations.reduce((acc, calc) => {
    const pair = calc.currency_pair || 'Unknown';
    acc[pair] = (acc[pair] || 0) + 1;
    return acc;
  }, {} as Record<string, number>)
)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([pair, count]) => `• ${pair}: ${count} calculations (${Math.round(count / totalCalculations * 100)}%)`)
  .join('\n')}

Keep up the great work! View detailed analytics in SpreadChecker dashboard.`;

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