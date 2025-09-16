// supabase/functions/lock-expired-trials/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const now = new Date().toISOString()
    
    // Find companies with expired trials that aren't on active subscriptions
    const { data: expiredCompanies, error: fetchError } = await supabase
      .from('companies')
      .select('id, name, trial_ends_at')
      .lt('trial_ends_at', now)  // Trial has ended
      .eq('subscription_active', false)  // Not on paid subscription
      .eq('account_locked', false)  // Not already locked

    if (fetchError) {
      console.error('Error fetching expired trials:', fetchError)
      throw fetchError
    }

    if (!expiredCompanies || expiredCompanies.length === 0) {
      console.log('No expired trials to lock')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No expired trials found',
          lockedCount: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Lock the expired accounts
    const companyIds = expiredCompanies.map(c => c.id)
    
    const { error: updateError } = await supabase
      .from('companies')
      .update({ 
        account_locked: true,
        locked_at: now
      })
      .in('id', companyIds)

    if (updateError) {
      console.error('Error locking accounts:', updateError)
      throw updateError
    }

    console.log(`Successfully locked ${expiredCompanies.length} expired trial accounts:`)
    expiredCompanies.forEach(company => {
      console.log(`- ${company.name} (trial ended: ${company.trial_ends_at})`)
    })

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Locked ${expiredCompanies.length} expired trial accounts`,
        lockedCount: expiredCompanies.length,
        lockedCompanies: expiredCompanies.map(c => ({
          id: c.id,
          name: c.name,
          trial_ended: c.trial_ends_at
        }))
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in lock-expired-trials function:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})