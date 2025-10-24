// COPY THIS ENTIRE FILE TO: supabase/functions/scheduled-monthly-reports/index.ts

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const now = new Date()
    const currentDay = now.getDate()
    const currentHour = now.getUTCHours()

    console.log(`🕐 Checking schedules for day ${currentDay}, hour ${currentHour} UTC`)

    // Get all enabled schedules that match today's day and current hour (±1 hour buffer)
    const { data: schedules, error: schedulesError } = await supabase
      .from('monthly_report_schedule')
      .select(`
        *,
        companies!inner(
          id,
          name,
          client_data_enabled
        )
      `)
      .eq('enabled', true)
      .eq('day_of_month', currentDay)
      .gte('hour', currentHour - 1)
      .lte('hour', currentHour + 1)

    if (schedulesError) throw schedulesError

    if (!schedules || schedules.length === 0) {
      console.log('No schedules found for this time')
      return new Response(
        JSON.stringify({ success: true, message: 'No schedules due' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${schedules.length} schedules to process`)

    const results = []

    for (const schedule of schedules) {
      try {
        const company = schedule.companies

        // Check if client data add-on is enabled
        if (!company.client_data_enabled) {
          console.log(`⏭️  Skipping ${company.name} - client_data_enabled is false`)
          results.push({
            company: company.name,
            status: 'skipped',
            reason: 'Client data add-on not enabled'
          })
          continue
        }

        console.log(`📧 Triggering report for ${company.name}`)

        // Call the generate-monthly-report function for this company
        const reportResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-monthly-report`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({
              company_id: company.id,
              scheduled: true // Flag to indicate this is a scheduled run
            })
          }
        )

        const reportResult = await reportResponse.json()

        if (reportResponse.ok) {
          console.log(`✅ Report sent for ${company.name}`)
          results.push({
            company: company.name,
            status: 'success',
            ...reportResult
          })
        } else {
          console.error(`❌ Failed for ${company.name}:`, reportResult)
          results.push({
            company: company.name,
            status: 'failed',
            error: reportResult.error
          })
        }

      } catch (error) {
        console.error(`Error processing ${schedule.companies.name}:`, error)
        results.push({
          company: schedule.companies.name,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: schedules.length,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Scheduled reports error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})