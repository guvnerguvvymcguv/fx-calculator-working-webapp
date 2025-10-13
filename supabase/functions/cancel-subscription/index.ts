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
let shouldLockImmediately = false;

// Handle grace period logic based on subscription type
if (company.grace_period_used && company.subscription_type === 'monthly') {
  // Monthly second cancellation - lock immediately
  scheduledCancellationDate = now.toISOString();
  shouldLockImmediately = true;
  console.log('Monthly - Grace period already used - immediate lock');
} else if (company.grace_period_used && company.subscription_type === 'annual') {
  // Annual second cancellation - still give 30 days (they paid for the year)
  const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
  scheduledCancellationDate = thirtyDaysFromNow.toISOString();
  console.log('Annual - Grace period already used but giving 30 days (they paid for the year)');
} else if (company.subscription_type === 'monthly') {
  // Monthly first cancellation - access until end of paid period (industry standard)
  // They've already paid for this month, let them have it
  // scheduledCancellationDate will be set from Stripe response below
  console.log('Monthly - First cancellation - access until end of billing period');
} else {
  // Annual first cancellation - give 30 days grace period
  const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
  scheduledCancellationDate = thirtyDaysFromNow.toISOString();
  console.log('Annual - First cancellation - 30 day grace period');
}

// If monthly subscription with grace period used, lock immediately and cancel in Stripe
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
      scheduled_cancellation_date: scheduledCancellationDate,
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
        comment: feedback || reason || 'Customer cancelled after using grace period',
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

// For annual subscriptions or first-time cancellations, handle with grace period
let updatedSubscription;

if (company.subscription_type === 'annual') {
  // First update metadata BEFORE cancelling
  await stripe.subscriptions.update(
    company.stripe_subscription_id,
    {
      metadata: {
        cancelled_by: 'customer',
        cancellation_reason: reason || 'not_specified',
        cancellation_feedback: feedback || '',
        cancelled_at: now.toISOString(),
        grace_period_ends: scheduledCancellationDate
      }
    }
  );
  
  // Then cancel immediately - they won't get refund anyway
  updatedSubscription = await stripe.subscriptions.cancel(
    company.stripe_subscription_id,
    {
      cancellation_details: {
        comment: feedback || reason || 'Customer requested cancellation - 30 day grace period in app',
      }
    }
  );

} else {
  // For monthly, use cancel_at_period_end (they've paid for this month)
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
  
  // For monthly, use the Stripe billing period end as the scheduled cancellation date
  // This is when they've paid until - industry standard
  scheduledCancellationDate = new Date(updatedSubscription.current_period_end * 1000).toISOString();
}

console.log('Setting cancellation:', {
  subscriptionType: company.subscription_type,
  cancelledAt: now.toISOString(),
  accessEndsAt: scheduledCancellationDate,
  gracePeriodUsed: company.grace_period_used,
  stripePeriodEnd: updatedSubscription.current_period_end 
    ? new Date(updatedSubscription.current_period_end * 1000).toISOString() 
    : 'unknown'
})

// Update company record in database (for grace period cancellations)
const { error: updateError } = await supabase
  .from('companies')
  .update({
    subscription_status: 'canceling',
    cancel_at_period_end: true,
    scheduled_cancellation_date: scheduledCancellationDate,
    grace_period_used: true,
    cancellation_reason: reason,
    cancellation_feedback: feedback,
    cancelled_at: now.toISOString(),
    subscription_active: true,
    account_locked: false,
    updated_at: now.toISOString()
  })
  .eq('id', companyId)

  if (updateError) {  // ← ADD THIS CHECK
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

    const daysRemaining = Math.ceil((new Date(scheduledCancellationDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

return new Response(
  JSON.stringify({ 
    success: true,
    message: company.subscription_type === 'monthly' 
      ? 'Subscription cancelled - access until end of billing period'
      : 'Subscription cancelled - 30 day grace period activated',
    cancellation_date: scheduledCancellationDate,
    days_remaining: daysRemaining,
    subscription_id: updatedSubscription?.id || 'unknown',
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