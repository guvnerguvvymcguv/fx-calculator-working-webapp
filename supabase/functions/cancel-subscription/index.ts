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
    const { companyId, reason, feedback, isTrialCancellation = false } = await req.json()
    
    if (!companyId) {
      throw new Error('Company ID is required')
    }

    console.log('Processing cancellation for company:', companyId, { isTrialCancellation })

    // Get company details including Stripe subscription ID
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*, user_profiles!inner(email, full_name, role_type)')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      throw new Error('Company not found')
    }

    // Handle trial cancellation differently
    if (isTrialCancellation || company.subscription_status === 'trialing') {
      console.log('Cancelling trial - immediate lock')
      
      // For trials, lock immediately
      const { error: trialUpdateError } = await supabase
        .from('companies')
        .update({
          subscription_status: 'cancelled',
          subscription_active: false,
          account_locked: true,
          trial_ends_at: new Date().toISOString(), // End trial immediately
          cancellation_reason: reason,
          cancellation_feedback: feedback,
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', companyId)

      if (trialUpdateError) {
        console.error('Trial cancellation error:', trialUpdateError)
        throw new Error('Failed to cancel trial')
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Trial cancelled - account locked immediately',
          subscription_type: 'trial'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // For paid subscriptions, handle with 30-day grace period
    if (!company.stripe_subscription_id) {
      throw new Error('No active subscription found')
    }

    // Check if they've already used their grace period
const now = new Date()
let scheduledCancellationDate;

if (company.grace_period_used) {
  // No grace period for repeat cancellations - lock immediately
  scheduledCancellationDate = now.toISOString();
  console.log('Grace period already used - immediate lock');
} else {
  // First cancellation - give 30 days grace period
  const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
  scheduledCancellationDate = thirtyDaysFromNow.toISOString();
  console.log('First cancellation - 30 day grace period');
}
    // For annual subscriptions, cancel immediately in Stripe but maintain 30-day access via app
    // For monthly, use cancel_at_period_end (they've already paid for the month)
let updatedSubscription;

if (company.subscription_type === 'annual') {
  // Cancel immediately - they won't get refund anyway
  updatedSubscription = await stripe.subscriptions.cancel(
    company.stripe_subscription_id,
    {
      cancellation_details: {
        comment: feedback || reason || 'Customer requested cancellation - 30 day grace period in app',
      }
    }
  );
  
  // Update metadata separately since cancel doesn't support it
  await stripe.subscriptions.update(
    company.stripe_subscription_id,
    {
      metadata: {
        cancelled_by: 'customer',
        cancellation_reason: reason || 'not_specified',
        cancellation_feedback: feedback || '',
        cancelled_at: new Date().toISOString(),
        grace_period_ends: new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)).toISOString()
      }
    }
  );
} else {
  // For monthly, use cancel_at_period_end (they paid for this month)
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
  );
}

    console.log('Setting 30-day grace period:', {
      subscriptionType: company.subscription_type,
      cancelledAt: now.toISOString(),
      accessEndsAt: scheduledCancellationDate,
      stripeOriginalEnd: updatedSubscription.current_period_end 
        ? new Date(updatedSubscription.current_period_end * 1000).toISOString() 
        : 'unknown'
    })

    // Update company record in database
    const { error: updateError } = await supabase
      .from('companies')
      .update({
        subscription_status: 'canceling',
        cancel_at_period_end: true,
        scheduled_cancellation_date: scheduledCancellationDate, // 30 days from now
        grace_period_used: true,
        cancellation_reason: reason,
        cancellation_feedback: feedback,
        cancelled_at: now.toISOString(),
        // Keep active for the 30-day grace period
        subscription_active: true,
        account_locked: false,
        updated_at: now.toISOString()
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
        console.log(`Would send cancellation email to ${admin.email}`)
        // Email should mention 30-day grace period
        // You can create a separate cancellation-email function or handle it here
      } catch (emailError) {
        console.error('Failed to send cancellation email:', emailError)
        // Don't throw - email failure shouldn't break the cancellation
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Subscription cancelled - 30 day grace period activated',
        cancellation_date: scheduledCancellationDate,
        days_remaining: 30,
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