// supabase/functions/update-subscription/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Define pricing tiers with Stripe price IDs (these are VAT-inclusive prices)
// Tier ranges: 1-5 (Standard), 6-12 (Team), 13+ (Enterprise)
const PRICING_TIERS = {
  STANDARD: { 
    productId: 'prod_T8XJnL61gY927i',
    annualProductId: 'prod_TCLns1si1ulZ4p',
    priceId: 'price_1SCGF55du1W5ijSGxcs7zQQX', 
    maxSeats: 5,
    pricePerSeat: 30
  },
  TEAM: { 
    productId: 'prod_T8XMTp9qKMSyVh',
    annualProductId: 'prod_TCLoT9ndmjiSkW',
    priceId: 'price_1SCGHX5du1W5ijSGSx4iqFXi', 
    maxSeats: 12,
    pricePerSeat: 27
  },
  ENTERPRISE: { 
    productId: 'prod_T8XNn9mRSDskk7',
    annualProductId: 'prod_TCLqYrus5QQlKi',
    priceId: 'price_1SCGIk5du1W5ijSG3jIFMf9L', 
    maxSeats: null,
    pricePerSeat: 24
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Check if Stripe key exists
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      console.error('STRIPE_SECRET_KEY not found in environment')
      throw new Error('Stripe configuration error')
    }

    // Initialize Stripe with correct API version
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      typescript: true,
    })

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase environment variables missing')
      throw new Error('Supabase configuration error')
    }

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseKey,
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    
    if (userError || !user) {
      console.error('User authentication failed:', userError)
      throw new Error('Authentication required')
    }

    // Parse request body
    const body = await req.json()
    const { companyId, newSeatCount, newPrice, isReduction = false, skipPayment = false } = body
    
    console.log('Update subscription request:', { 
      companyId, 
      newSeatCount,
      newPrice,
      isReduction,
      skipPayment,
      userId: user.id 
    })

    // Validate input
    if (!companyId || !newSeatCount || !newPrice) {
      throw new Error('Missing required parameters')
    }

    // Get company details
    const { data: company, error: companyError } = await supabaseClient
      .from('companies')
      .select('stripe_subscription_id, subscription_type, stripe_customer_id, subscription_seats')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      console.error('Company fetch error:', companyError)
      throw new Error('Company not found')
    }

    // Check if subscription ID exists
    if (!company.stripe_subscription_id) {
      throw new Error('No active Stripe subscription found')
    }

    console.log('Retrieving subscription:', company.stripe_subscription_id)

    // Get the current subscription
    const subscription = await stripe.subscriptions.retrieve(company.stripe_subscription_id)

    if (!subscription || (subscription.status !== 'active' && subscription.status !== 'past_due')) {
      throw new Error('Subscription is not active')
    }

    // Get current seat count
    const currentSeatCount = subscription.items.data[0].quantity || 0;
    const seatDifference = newSeatCount - currentSeatCount;
    
    console.log('Seat change details:', {
      current: currentSeatCount,
      new: newSeatCount,
      difference: seatDifference,
      isReduction,
      skipPayment
    });

    // If no changes, exit early
    if (seatDifference === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No seat changes detected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Determine which pricing tier to use based on NEW seat count
    let selectedTier;
    if (newSeatCount <= 5) {
      selectedTier = PRICING_TIERS.STANDARD;
    } else if (newSeatCount <= 12) {
      selectedTier = PRICING_TIERS.TEAM;
    } else {
      selectedTier = PRICING_TIERS.ENTERPRISE;
    }

    console.log('Selected tier:', selectedTier);

    // Determine the product ID based on subscription type
    const productId = company.subscription_type === 'annual' 
      ? selectedTier.annualProductId 
      : selectedTier.productId;

    // Calculate price based on subscription type
    let priceWithVatPence;
    let recurringInterval;
    
    if (company.subscription_type === 'annual') {
      // Annual: price per seat per year with 10% discount
      const annualPricePerSeat = selectedTier.pricePerSeat * 12 * 0.9; // 10% discount
      const vatAmount = Math.round(annualPricePerSeat * 100 * 0.2);
      priceWithVatPence = Math.round(annualPricePerSeat * 100) + vatAmount;
      recurringInterval = { interval: 'year' as const };
    } else {
      // Monthly: price per seat per month
      const pricePerSeatPreVat = selectedTier.pricePerSeat * 100; // Convert to pence
      const vatAmount = Math.round(pricePerSeatPreVat * 0.2);
      priceWithVatPence = pricePerSeatPreVat + vatAmount;
      recurringInterval = { interval: 'month' as const };
    }

    console.log('Price calculation:', {
      subscriptionType: company.subscription_type,
      pricePerSeat: selectedTier.pricePerSeat,
      priceWithVatPence,
      interval: recurringInterval.interval
    });

    // Create a new price with VAT included
    const stripePriceWithVat = await stripe.prices.create({
      currency: 'gbp',
      unit_amount: priceWithVatPence,
      recurring: recurringInterval,
      product: productId,
    });

    // Determine proration behavior based on the situation
    let prorationBehavior: 'always_invoice' | 'none' = 'always_invoice';
    
    if (skipPayment) {
      // After successful payment, don't charge again
      prorationBehavior = 'none';
      console.log('Skipping payment - already paid through checkout');
    } else if (isReduction) {
      // For seat reductions, update without creating charges
      prorationBehavior = 'none';
      console.log('Seat reduction - no proration charge');
    } else {
      // This shouldn't happen anymore as additions go through payment flow
      // But keeping as fallback
      prorationBehavior = 'always_invoice';
      console.log('Standard update with proration');
    }

    // Update the subscription
    const updatedSubscription = await stripe.subscriptions.update(
      company.stripe_subscription_id,
      {
        items: [{
          id: subscription.items.data[0].id,
          price: stripePriceWithVat.id,
          quantity: newSeatCount
        }],
        proration_behavior: prorationBehavior,
        metadata: {
          seat_count: newSeatCount.toString(),
          price_per_month: newPrice.toString(),
          last_seat_change: new Date().toISOString(),
          change_type: isReduction ? 'reduction' : 'addition'
        }
      }
    );

    console.log('Subscription updated successfully:', {
      subscriptionId: updatedSubscription.id,
      status: updatedSubscription.status,
      prorationBehavior,
      newQuantity: newSeatCount
    });

    // Clear any pending seat changes if this was called after payment
    if (skipPayment) {
      const { error: clearError } = await supabaseClient
        .from('companies')
        .update({
          pending_seat_change: null,
          pending_admin_seats: null,
          pending_junior_seats: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', companyId);

      if (clearError) {
        console.error('Failed to clear pending changes:', clearError);
      }
    }

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true,
        subscription_type: company.subscription_type,
        seat_change: seatDifference,
        proration_applied: !skipPayment && !isReduction,
        subscription: {
          id: updatedSubscription.id,
          status: updatedSubscription.status,
          current_period_end: updatedSubscription.current_period_end,
          new_quantity: newSeatCount
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Edge function error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    const errorDetails = error instanceof Error ? error.stack : undefined
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})