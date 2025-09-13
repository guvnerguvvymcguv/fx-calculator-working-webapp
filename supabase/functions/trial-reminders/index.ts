// supabase/functions/trial-reminders/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // 30-day reminder
  const { data: thirtyDayCompanies } = await supabase
    .from('companies')
    .select('*, user_profiles!inner(email)')
    .lte('trial_ends_at', thirtyDaysFromNow.toISOString())
    .gt('trial_ends_at', now.toISOString())
    .eq('trial_reminder_sent', false)
    .eq('subscription_active', false);

  // 7-day reminder
  const { data: sevenDayCompanies } = await supabase
    .from('companies')
    .select('*, user_profiles!inner(email)')
    .lte('trial_ends_at', sevenDaysFromNow.toISOString())
    .gt('trial_ends_at', now.toISOString())
    .eq('final_reminder_sent', false)
    .eq('subscription_active', false);

  // Send emails via Resend for each group
  // ... email sending logic
  
  return new Response('Reminders sent', { status: 200 });
});