// supabase/functions/cancel-trial/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Initialize Supabase client with service role for admin operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse request body
    const { companyId, reason, feedback } = await req.json()

    if (!companyId) {
      throw new Error('Company ID is required')
    }

    console.log('Cancelling trial for company:', companyId)
    console.log('Reason:', reason)
    console.log('Feedback:', feedback)

    // Get current timestamp
    const now = new Date().toISOString()

    // Update company record to cancel trial
    const { data: company, error: updateError } = await supabase
      .from('companies')
      .update({
        trial_ends_at: now, // End trial immediately
        account_locked: true,
        locked_at: now,
        subscription_status: 'cancelled',
        subscription_active: false,
        cancellation_reason: reason,
        cancellation_feedback: feedback,
        cancelled_at: now,
        updated_at: now
      })
      .eq('id', companyId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating company:', updateError)
      throw new Error(`Failed to cancel trial: ${updateError.message}`)
    }

    console.log('Trial cancelled successfully for company:', company.name)

    // Optionally, deactivate all users for this company
    const { error: usersError } = await supabase
      .from('user_profiles')
      .update({ 
        is_active: false,
        updated_at: now
      })
      .eq('company_id', companyId)

    if (usersError) {
      console.error('Error deactivating users:', usersError)
      // Don't throw - company is already cancelled
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Trial cancelled successfully',
        company: company.name
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Trial cancellation error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})