/// <reference types="https://deno.land/x/types/index.d.ts" />
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

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
      
      // Send via email or webhook
      await sendReport(schedule.recipient, report);
    }
  }

  return new Response('Export completed', { status: 200 });
});

function generateSalesforceReport(activities: any[]) {
  return {
    reportTitle: `Weekly Export - ${new Date().toISOString()}`,
    totalCalculations: activities.length,
    totalSavings: activities.reduce((sum, a) => sum + (a.savings_amount || 0), 0),
    records: activities.map(a => ({
      date: a.created_at,
      clientName: a.client_name,
      currencyPair: a.currency_pair,
      amount: a.amount,
      savingsAmount: a.savings_amount
    }))
  };
}

async function sendReport(recipient: string, report: any) {
  console.log(`Would send report to ${recipient}:`, report);
  // TODO: Implement actual email sending
}