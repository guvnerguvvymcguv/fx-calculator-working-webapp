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

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Get request body for manual exports
  const { userIds, dateRange, companyId } = await req.json();
  
  // Get Salesforce connection for this company
  const { data: sfConnection } = await supabase
    .from('salesforce_connections')
    .select('*')
    .eq('company_id', companyId)
    .single();

  if (!sfConnection) {
    console.error(`No Salesforce connection found for company ${companyId}`);
    return new Response(
      JSON.stringify({ error: 'No Salesforce connection found' }), 
      { status: 400 }
    );
  }

  // Parse date range
  const startDate = new Date(dateRange?.start || new Date().setDate(new Date().getDate() - 7));
  const endDate = new Date(dateRange?.end || new Date());
  
  // Build query based on whether specific users or whole company
  let query = supabase
    .from('calculations')
    .select('*, user_profiles!inner(full_name, email)')
    .eq('company_id', companyId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: false });
  
  // If specific users requested, filter by them
  if (userIds && userIds.length > 0) {
    query = query.in('user_id', userIds);
  }
  
  const { data: calculations } = await query;

  if (!calculations || calculations.length === 0) {
    const messageText = `📊 SpreadChecker Export (${startDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} - ${endDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })})

No calculations recorded for this period.`;

    await postToSalesforce(sfConnection, messageText, supabase);
    
    return new Response(
      JSON.stringify({ success: true, message: 'Export completed (no data)' }), 
      { status: 200 }
    );
  }

  // Calculate statistics
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
  let messageText = `📊 SpreadChecker Export (${startDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} - ${endDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })})

Avg Trade Value: £${Math.round(avgTradeValue).toLocaleString()}
Amt Calculations: ${calculations.length}

`;

  // If single user export, show just their calculations
  if (userIds && userIds.length === 1) {
    // Single user export - simpler format
    const userName = Object.keys(userGroups)[0];
    const userCalcs = userGroups[userName];
    
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
  } else {
    // Team export - grouped by user
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
  }

  // Add footer
  messageText += `\nView detailed analytics in SpreadChecker dashboard.`;

  // Truncate if too long for Salesforce (max 10,000 characters)
  if (messageText.length > 9900) {
    messageText = messageText.substring(0, 9900) + '\n\n[Message truncated - view full details in SpreadChecker]';
  }

  await postToSalesforce(sfConnection, messageText, supabase);
  
  return new Response(
    JSON.stringify({ 
      success: true, 
      message: `Export completed - ${calculations.length} calculations sent to Salesforce` 
    }), 
    { status: 200 }
  );
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