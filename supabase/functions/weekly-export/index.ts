/// <reference types="https://deno.land/x/types/index.d.ts" />
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

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
      // Generate export for this company
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      
      const { data: activities } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('company_id', schedule.company_id)
        .gte('created_at', weekStart.toISOString())
        .order('created_at', { ascending: false });

      // Format as Salesforce report
      const report = generateSalesforceReport(activities || []);
      
      // Send via Resend
      await sendReportViaResend(schedule.recipient, report, RESEND_API_KEY);
    }
  }

  return new Response('Export completed', { status: 200 });
});

function generateSalesforceReport(activities: any[]) {
  const totalSavings = activities.reduce((sum, a) => sum + (a.savings_amount || 0), 0);
  
  return {
    reportTitle: `Weekly Export - ${new Date().toISOString().split('T')[0]}`,
    totalCalculations: activities.length,
    totalSavings: totalSavings,
    averageTradeValue: activities.length > 0 
      ? activities.reduce((sum, a) => sum + (a.amount || 0), 0) / activities.length 
      : 0,
    records: activities.map(a => ({
      date: a.created_at,
      clientName: a.client_name || 'N/A',
      currencyPair: a.currency_pair || 'N/A',
      amount: a.amount || 0,
      savingsAmount: a.savings_amount || 0,
      yourRate: a.your_rate || 0,
      competitorRate: a.competitor_rate || 0,
      pipsSaved: a.pips_difference || 0
    }))
  };
}

async function sendReportViaResend(recipient: string, report: any, apiKey: string) {
  // Generate CSV content
  const csvContent = generateCSV(report);
  const jsonContent = JSON.stringify(report, null, 2);
  
  // Create HTML email body
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #10051A; padding: 20px; text-align: center;">
        <h1 style="color: #C7B3FF; margin: 0;">Spread Checker</h1>
      </div>
      
      <div style="padding: 30px; background-color: #f5f5f5;">
        <h2 style="color: #333;">Weekly Export Report</h2>
        
        <p style="color: #666;">Your automated weekly report is ready for import into Salesforce.</p>
        
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">Summary</h3>
          <ul style="color: #666;">
            <li><strong>Total Calculations:</strong> ${report.totalCalculations}</li>
            <li><strong>Total Savings:</strong> £${report.totalSavings.toFixed(2)}</li>
            <li><strong>Average Trade Value:</strong> £${report.averageTradeValue.toFixed(2)}</li>
          </ul>
        </div>
        
        <p style="color: #666;">
          Two files are attached:
          <br>• CSV format for easy import
          <br>• JSON format with detailed structure
        </p>
      </div>
      
      <div style="background-color: #333; padding: 20px; text-align: center;">
        <p style="color: #999; margin: 0; font-size: 12px;">
          © 2025 Spread Checker. Professional FX spread calculation for brokerage teams.
        </p>
      </div>
    </div>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'reports@spreadchecker.co.uk',
        to: recipient,
        subject: `Weekly Spread Checker Report - ${new Date().toLocaleDateString('en-GB')}`,
        html: htmlBody,
        attachments: [
          {
            filename: `weekly_report_${new Date().toISOString().split('T')[0]}.csv`,
            content: btoa(csvContent)
          },
          {
            filename: `weekly_report_${new Date().toISOString().split('T')[0]}.json`,
            content: btoa(jsonContent)
          }
        ]
      })
    });

    if (!response.ok) {
      console.error('Failed to send email:', await response.text());
    } else {
      console.log('Email sent successfully to:', recipient);
    }
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

function generateCSV(report: any): string {
  const headers = ['Date', 'Client Name', 'Currency Pair', 'Your Rate', 'Competitor Rate', 'Amount', 'PIPs Saved', 'Savings'];
  
  const rows = report.records.map((r: any) => [
    new Date(r.date).toLocaleDateString('en-GB'),
    `"${r.clientName}"`,
    r.currencyPair,
    r.yourRate,
    r.competitorRate,
    r.amount,
    r.pipsSaved,
    r.savingsAmount.toFixed(2)
  ].join(','));
  
  return [headers.join(','), ...rows].join('\n');
}