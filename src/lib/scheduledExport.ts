import { createClient } from '@supabase/supabase-js';

// This would run on a server/edge function
export async function scheduleWeeklyExport(companyId: string, config: {
  dayOfWeek: number; // 0=Sunday, 1=Monday, etc.
  hour: number; // 0-23
  recipient: string; // Email or webhook URL
}) {
  // Store schedule in database
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY! // Service key for server-side
  );

  await supabase
    .from('export_schedules')
    .upsert({
      company_id: companyId,
      schedule_type: 'weekly',
      day_of_week: config.dayOfWeek,
      hour: config.hour,
      recipient: config.recipient,
      is_active: true
    });
}