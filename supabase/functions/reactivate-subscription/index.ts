// supabase/functions/reactivate-subscription/index.ts
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
    const { companyId } = await req.json()
    
    if (!companyId) {
      throw new Error('Company ID is required')
    }

    console.log('Processing reactivation for company:', companyId)

    // Get company details including Stripe subscription ID
    const { data: company, error: companyError } = await supabase
     .from('companies')
     .select('stripe_subscription_id, cancel_at_period_end, subscription_type, grace_period_used, subscription_seats, admin_seats, junior_seats, price_per_month')
     .eq('id', companyId)
     .single()

    if (companyError || !company) {
      throw new Error('Company not found')
    }

    // If they've already used their grace period, require payment for reactivation
if (company.grace_period_used) {
  console.log('Grace period already used - payment required for reactivation')
  return new Response(
    JSON.stringify({ 
      error: 'Grace period already used. Payment required to reactivate.',
      requiresPayment: true,
      seatCount: company.subscription_seats,
      adminSeats: company.admin_seats,
      juniorSeats: company.junior_seats,
      pricePerMonth: company.price_per_month,
      subscriptionType: company.subscription_type
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    }
  )
}

    if (!company.stripe_subscription_id) {
      throw new Error('No active subscription found')
    }

    if (!company.cancel_at_period_end) {
      throw new Error('Subscription is not scheduled for cancellation')
    }

    // Reactivate the subscription in Stripe
    let reactivatedSubscription
    try {
      if (company.stripe_subscription_id.startsWith('sub_')) {
        // Update subscription to NOT cancel at period end
        reactivatedSubscription = await stripe.subscriptions.update(
          company.stripe_subscription_id,
          {
            cancel_at_period_end: false,
            metadata: {
              reactivated_at: new Date().toISOString(),
              reactivated_by: 'customer'
            }
          }
        )
        
        console.log('Stripe subscription reactivated:', reactivatedSubscription.id)
      } else {
        // Handle non-standard subscription IDs (shouldn't happen but just in case)
        throw new Error('Invalid subscription ID format')
      }
    } catch (stripeError) {
      console.error('Stripe reactivation error:', stripeError)
      throw new Error('Failed to reactivate subscription with payment provider')
    }

    // Update company record in database to clear cancellation
    const { error: updateError } = await supabase
  .from('companies')
  .update({
    subscription_status: 'active',
    cancel_at_period_end: false,
    scheduled_cancellation_date: null,
    cancelled_at: null,
    cancellation_reason: null,
    cancellation_feedback: null,
    grace_period_used: false,  // Reset for next cancellation
    updated_at: new Date().toISOString()
  })
  .eq('id', companyId)

    if (updateError) {
      console.error('Database update error:', updateError)
      // Try to revert Stripe change
      try {
        await stripe.subscriptions.update(
          company.stripe_subscription_id,
          { cancel_at_period_end: true }
        )
      } catch (revertError) {
        console.error('Failed to revert Stripe change:', revertError)
      }
      throw new Error('Failed to update subscription status in database')
    }

    console.log('Subscription successfully reactivated for company:', companyId)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Subscription reactivated successfully',
        subscription_type: company.subscription_type
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Reactivation error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to reactivate subscription'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})