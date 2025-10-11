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

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Check if this is a forced run for testing
  const url = new URL(req.url);
  const forceRun = url.searchParams.get('force') === 'true';

  // Get all active export schedules
  const { data: schedules, error: schedulesError } = await supabase
    .from('export_schedules')
    .select('*')
    .eq('is_active', true);

  if (schedulesError) {
    console.error('Error fetching schedules:', schedulesError);
    return new Response(JSON.stringify({ error: 'Failed to fetch schedules' }), { status: 500 });
  }

  const now = new Date();
  
  // Calculate UK time (handles BST/GMT automatically)
  // UK is BST (UTC+1) from last Sunday of March to last Sunday of October
  function getUKTimeFromUTC(utcDate: Date) {
    const year = utcDate.getUTCFullYear();
    
    // Get last Sunday of March
    const marchLastSunday = new Date(Date.UTC(year, 2, 31));
    marchLastSunday.setUTCDate(31 - ((marchLastSunday.getUTCDay() + 7) % 7));
    
    // Get last Sunday of October  
    const octoberLastSunday = new Date(Date.UTC(year, 9, 31));
    octoberLastSunday.setUTCDate(31 - ((octoberLastSunday.getUTCDay() + 7) % 7));
    
    // Check if we're in BST period
    const isBST = utcDate >= marchLastSunday && utcDate < octoberLastSunday;
    
    // Create a new date with UK time
    const ukDate = new Date(utcDate.getTime());
    if (isBST) {
      ukDate.setUTCHours(ukDate.getUTCHours() + 1);
    }
    
    return {
      day: ukDate.getUTCDay(),
      hour: ukDate.getUTCHours(),
      isBST: isBST
    };
  }
  
  const ukTime = getUKTimeFromUTC(now);
  const currentDay = ukTime.day;
  const currentHour = ukTime.hour;

  console.log('=== Weekly Export Check ===');
  console.log('Current UTC time:', now.toISOString());
  console.log('UK timezone:', ukTime.isBST ? 'BST (UTC+1)' : 'GMT (UTC+0)');
  console.log('UK Day:', currentDay, 'UK Hour:', currentHour);
  console.log('Force run:', forceRun);
  console.log('Active schedules found:', schedules?.length || 0);

  for (const schedule of schedules || []) {
    console.log(`\nChecking schedule ID ${schedule.id}:`);
    console.log(`  Company: ${schedule.company_id}`);
    console.log(`  Scheduled: Day ${schedule.day_of_week} Hour ${schedule.hour} (stored as UK time)`);
    console.log(`  Current:   Day ${currentDay} Hour ${currentHour} (converted UK time)`);
    console.log(`  Match: Day match=${schedule.day_of_week === currentDay}, Hour match=${schedule.hour === currentHour}`);
    
    // Check if should run (either matches schedule OR force run)
    // Schedule times are stored as UK times, now comparing with UK time
    const shouldRun = forceRun || (schedule.day_of_week === currentDay && schedule.hour === currentHour);
    
    if (shouldRun) {
      console.log('✅ Should run! Processing...');
      
      // Check if company account is locked
      const { data: company } = await supabase
        .from('companies')
        .select('account_locked')
        .eq('id', schedule.company_id)
        .single();

      if (company?.account_locked) {
        console.log(`❌ Company ${schedule.company_id} account is locked (trial expired). Skipping export.`);
        continue;
      }
      
      // Check if already ran this hour (unless forced)
      if (!forceRun && schedule.last_run) {
        const lastRun = new Date(schedule.last_run);
        if (lastRun.getUTCFullYear() === now.getUTCFullYear() &&
            lastRun.getUTCMonth() === now.getUTCMonth() &&
            lastRun.getUTCDate() === now.getUTCDate() &&
            lastRun.getUTCHours() === now.getUTCHours()) {
          console.log('Already ran this hour, skipping...');
          continue;
        }
      }
      
      try {
        // Get Salesforce connection for this company
        const { data: sfConnection, error: sfError } = await supabase
          .from('salesforce_connections')
          .select('*')
          .eq('company_id', schedule.company_id)
          .single();

        if (sfError || !sfConnection) {
          console.error(`No Salesforce connection found for company ${schedule.company_id}:`, sfError);
          continue;
        }

        console.log('Found Salesforce connection');

        // Generate export for this company - last 7 days
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - 7);
        
        // Get all calculations from activity_logs table - JUNIOR BROKERS ONLY
// First, get all junior broker user IDs for this company
const { data: juniorUsers, error: juniorError } = await supabase
  .from('user_profiles')
  .select('id')
  .eq('company_id', schedule.company_id)
  .eq('role_type', 'junior');  // Only junior brokers

if (juniorError) {
  console.error('Error fetching junior users:', juniorError);
  continue;
}

const juniorUserIds = juniorUsers?.map(u => u.id) || [];

if (juniorUserIds.length === 0) {
  console.log(`No junior users found for company ${schedule.company_id}`);
  
  // Still post a message saying no calculations
  const messageText = `📊 SpreadChecker Weekly Export - ${now.toLocaleDateString('en-GB')}\n\n` +
    `Period: ${weekStart.toLocaleDateString('en-GB')} - ${now.toLocaleDateString('en-GB')}\n\n` +
    `No junior brokers in this company.\n\n`;

  await postToSalesforce(sfConnection, messageText, supabase);
  console.log('Posted "no junior brokers" message to Salesforce');
  
  // Update last_run and continue
  await supabase
    .from('export_schedules')
    .update({ 
      last_run: now.toISOString(),
      updated_at: now.toISOString()
    })
    .eq('id', schedule.id);
  
  continue;
}

// Now fetch calculations for junior brokers only
const { data: calculations, error: calcError } = await supabase
  .from('activity_logs')
  .select('*')
  .in('user_id', juniorUserIds)  // ✅ Only junior broker calculations
  .gte('created_at', weekStart.toISOString())
  .lte('created_at', now.toISOString())
  .order('created_at', { ascending: false });

        if (calcError) {
          console.error('Error fetching calculations:', calcError);
          continue;
        }

        console.log(`Found ${calculations?.length || 0} calculations`);

        if (!calculations || calculations.length === 0) {
          console.log(`No calculations found for company ${schedule.company_id} in the last week`);
          
          // Still post a message saying no calculations
          const messageText = `📊 SpreadChecker Weekly Export - ${now.toLocaleDateString('en-GB')}\n\n` +
            `Period: ${weekStart.toLocaleDateString('en-GB')} - ${now.toLocaleDateString('en-GB')}\n\n` +
            `No calculations recorded this week.\n\n` +
            `Encourage your team to use SpreadChecker to track all FX calculations and identify savings opportunities.`;

          await postToSalesforce(sfConnection, messageText, supabase);
          console.log('Posted "no calculations" message to Salesforce');
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
              
              // Determine if this is a win or loss (same logic as Calculator and UserActivity)
              const isAdvantage = calc.your_rate > calc.competitor_rate;
              
              messageText += `Results\n`
              messageText += `PD ${calc.price_difference >= 0 ? '+' : ''}${calc.price_difference || 0} | `
              messageText += `Pips ${isAdvantage ? '✅' : '❌'} ${calc.pips_difference || 0} | `
              messageText += `${isAdvantage ? '❌' : '✅'} CWC £${calc.cost_with_competitor?.toFixed(2) || 0} | `
              messageText += `${isAdvantage ? '✅' : '❌'} CWU £${calc.cost_with_us?.toFixed(2) || 0} | `
              messageText += `${isAdvantage ? '✅' : '❌'} SVT £${calc.savings_per_trade?.toFixed(2) || 0} | `
              messageText += `${isAdvantage ? '✅' : '❌'} AS £${calc.annual_savings?.toFixed(2) || 0} | `
              messageText += `${isAdvantage ? '✅' : '❌'} PS ${calc.percentage_savings?.toFixed(2) || 0}%\n`
          }
        }

          // Truncate if too long for Salesforce (max 10,000 characters)
          if (messageText.length > 9900) {
            messageText = messageText.substring(0, 9900) + '\n\n[Message truncated - view full details in SpreadChecker]';
          }

          await postToSalesforce(sfConnection, messageText, supabase);
          console.log('Successfully posted calculations to Salesforce');
        }

        // Update last_run timestamp
        await supabase
          .from('export_schedules')
          .update({ 
            last_run: now.toISOString(),
            updated_at: now.toISOString()
          })
          .eq('id', schedule.id);

        console.log(`✅ Successfully exported data for company ${schedule.company_id}`);
      } catch (error) {
        console.error(`❌ Error processing schedule for company ${schedule.company_id}:`, error);
      }
    } else {
      console.log('❌ Schedule does not match, skipping');
    }
  }

  return new Response(JSON.stringify({ message: 'Weekly exports completed', forceRun }), { 
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
});