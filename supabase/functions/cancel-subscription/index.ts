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
          locked_at: new Date().toISOString(),
          trial_ends_at: new Date().toISOString(),
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
          accountLocked: true,
          subscription_type: 'trial'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // For paid subscriptions
    if (!company.stripe_subscription_id) {
      throw new Error('No active subscription found')
    }

    const now = new Date()
    let scheduledCancellationDate;
    let shouldLockImmediately = false;

    // Handle grace period logic based on subscription type
    if (company.subscription_type === 'annual') {
      // Annual cancellation - ALWAYS lock immediately (first or second time)
      scheduledCancellationDate = now.toISOString();
      shouldLockImmediately = true;
      console.log('Annual - Immediate lock');
    } else if (company.grace_period_used && company.subscription_type === 'monthly') {
      // Monthly second cancellation - lock immediately
      scheduledCancellationDate = now.toISOString();
      shouldLockImmediately = true;
      console.log('Monthly - Grace period already used - immediate lock');
    } else {
      // Monthly first cancellation - access until end of paid period
      console.log('Monthly - First cancellation - access until end of billing period');
    }

    // If should lock immediately (annual OR monthly second time)
    if (shouldLockImmediately) {
      console.log('Locking account immediately and cancelling Stripe subscription');
      
      // Update database to lock account
      const { error: lockError } = await supabase
        .from('companies')
        .update({
          subscription_status: 'cancelled',
          subscription_active: false,
          account_locked: true,
          locked_at: now.toISOString(),
          cancel_at_period_end: true,
          scheduled_cancellation_date: null,
          grace_period_used: true,
          cancellation_reason: reason,
          cancellation_feedback: feedback,
          cancelled_at: now.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('id', companyId)

      if (lockError) {
        console.error('Database lock error:', lockError)
        throw new Error('Failed to lock account')
      }

      // Cancel subscription in Stripe immediately
      await stripe.subscriptions.cancel(
        company.stripe_subscription_id,
        {
          cancellation_details: {
            comment: feedback || reason || 'Customer cancelled subscription',
          }
        }
      )

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Subscription cancelled - account locked immediately',
          accountLocked: true,
          subscription_type: company.subscription_type
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // MONTHLY FIRST CANCELLATION: Use cancel_at_period_end (they've paid for this month)
    const updatedSubscription = await stripe.subscriptions.update(
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
          cancelled_at: now.toISOString()
        }
      }
    );
    
    // For monthly, use the Stripe billing period end as the scheduled cancellation date
    scheduledCancellationDate = new Date(updatedSubscription.current_period_end * 1000).toISOString();

    // Update database for monthly
    const { error: monthlyUpdateError } = await supabase
      .from('companies')
      .update({
        subscription_status: 'canceling',
        cancel_at_period_end: true,
        scheduled_cancellation_date: scheduledCancellationDate,
        cancellation_reason: reason,
        cancellation_feedback: feedback,
        cancelled_at: now.toISOString(),
        subscription_active: true,
        account_locked: false,
        updated_at: now.toISOString()
      })
      .eq('id', companyId)

    if (monthlyUpdateError) {
      console.error('Monthly database update error:', monthlyUpdateError)
      throw new Error('Failed to update subscription status')
    }

    console.log('Database updated with grace period (monthly):', {
      subscriptionType: company.subscription_type,
      cancelledAt: now.toISOString(),
      accessEndsAt: scheduledCancellationDate,
      gracePeriodUsed: company.grace_period_used
    });

    console.log('Stripe updated:', {
      subscriptionType: company.subscription_type,
      subscriptionId: updatedSubscription.id,
      stripePeriodEnd: new Date(updatedSubscription.current_period_end * 1000).toISOString()
    });

    // Send cancellation confirmation email to all admins
    const admins = company.user_profiles.filter((u: any) => u.role_type === 'admin')
    
    for (const admin of admins) {
      try {
        console.log(`Would send cancellation email to ${admin.email}`)
      } catch (emailError) {
        console.error('Failed to send cancellation email:', emailError)
      }
    }

    const daysRemaining = Math.ceil((new Date(scheduledCancellationDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Subscription cancelled - access until end of billing period',
        cancellation_date: scheduledCancellationDate,
        days_remaining: daysRemaining,
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