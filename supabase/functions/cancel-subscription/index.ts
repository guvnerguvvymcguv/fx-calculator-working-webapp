// supabase/functions/cancel-subscription/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'

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
    // Initialize Stripe
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY not configured')
    }
    
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      typescript: true,
    })

    // Initialize Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get request body
    const { companyId, reason, feedback } = await req.json()
    
    if (!companyId) {
      throw new Error('Company ID is required')
    }

    console.log('Processing cancellation for company:', companyId)

    // Get company details including Stripe subscription ID
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*, user_profiles!inner(email, full_name, role_type)')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      throw new Error('Company not found')
    }

    if (!company.stripe_subscription_id) {
      throw new Error('No active subscription found')
    }

    // Cancel the subscription in Stripe at period end for ALL subscription types
    let updatedSubscription
    try {
      if (company.stripe_subscription_id.startsWith('sub_')) {
        // Update subscription to cancel at period end (for both monthly and annual)
        updatedSubscription = await stripe.subscriptions.update(
          company.stripe_subscription_id,
          {
            cancel_at_period_end: true,
            cancellation_details: {
              comment: feedback || reason || 'Customer requested cancellation',
            },
            metadata: {
              cancelled_by: 'customer',
              cancellation_reason: reason || 'not_specified',
              cancellation_feedback: feedback || '',
              cancelled_at: new Date().toISOString()
            }
          }
        )
      } else {
        // It's a one-time payment session ID (annual), need to handle differently
        // For annual payments that aren't subscriptions, we just mark as cancelled in our DB
        updatedSubscription = { 
          id: company.stripe_subscription_id,
          current_period_end: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year from now
        }
      }
    } catch (stripeError) {
      console.error('Stripe cancellation error:', stripeError)
      throw new Error('Failed to cancel subscription with payment provider')
    }

    // Calculate when access ends
    const scheduledCancellationDate = updatedSubscription.current_period_end 
      ? new Date(updatedSubscription.current_period_end * 1000).toISOString()
      : null

    // Update company record in database - subscription stays active until period ends
    const { error: updateError } = await supabase
      .from('companies')
      .update({
        subscription_status: 'canceling',  // Changed from 'cancelled'
        cancel_at_period_end: true,  // New field - add to database
        scheduled_cancellation_date: scheduledCancellationDate,  // New field - add to database
        cancellation_reason: reason,
        cancellation_feedback: feedback,
        cancelled_at: new Date().toISOString(),  // When they initiated cancellation
        // Keep these as true/false until the period actually ends:
        subscription_active: true,  // Stay active until period ends
        account_locked: false,  // Don't lock until period ends
        updated_at: new Date().toISOString()
      })
      .eq('id', companyId)

    if (updateError) {
      console.error('Database update error:', updateError)
      throw new Error('Failed to update subscription status')
    }

    // Send cancellation confirmation email to all admins
    const admins = company.user_profiles.filter((u: any) => u.role_type === 'admin')
    
    for (const admin of admins) {
      try {
        // Call your existing email function or send directly
        console.log(`Would send cancellation email to ${admin.email}`)
        // You can create a separate cancellation-email function or handle it here
      } catch (emailError) {
        console.error('Failed to send cancellation email:', emailError)
        // Don't throw - email failure shouldn't break the cancellation
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Subscription scheduled for cancellation',
        cancellation_date: scheduledCancellationDate,
        subscription_id: updatedSubscription.id,
        subscription_type: company.subscription_type
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Cancellation error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to cancel subscription'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})