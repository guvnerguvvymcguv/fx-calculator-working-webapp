// supabase/functions/update-subscription/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Define pricing tiers with Stripe price IDs (these are VAT-inclusive prices)
const PRICING_TIERS = {
  STANDARD: { 
    productId: 'prod_T8XJnL61gY927i',
    priceId: 'price_1SCGF55du1W5ijSGxcs7zQQX', 
    maxSeats: 14,
    pricePerSeat: 30
  },
  TEAM: { 
    productId: 'prod_T8XMTp9qKMSyVh',
    priceId: 'price_1SCGHX5du1W5ijSGSx4iqFXi', 
    maxSeats: 29,
    pricePerSeat: 27
  },
  ENTERPRISE: { 
    productId: 'prod_T8XNn9mRSDskk7',
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
    const { companyId, newSeatCount, newPrice } = body
    
    console.log('Update subscription request:', { 
      companyId, 
      newSeatCount,
      newPrice,
      userId: user.id 
    })

    // Validate input
    if (!companyId || !newSeatCount || !newPrice) {
      throw new Error('Missing required parameters')
    }

    // Get company details
    const { data: company, error: companyError } = await supabaseClient
      .from('companies')
      .select('stripe_subscription_id, subscription_type, stripe_customer_id')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      console.error('Company fetch error:', companyError)
      throw new Error('Company not found')
    }

    // Check if it's a monthly subscription
    if (company.subscription_type !== 'monthly') {
      console.log('Not a monthly subscription, no Stripe update needed')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Not a monthly subscription - no Stripe adjustment needed' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Check if subscription ID exists
    if (!company.stripe_subscription_id) {
      throw new Error('No active Stripe subscription found')
    }

    console.log('Retrieving subscription:', company.stripe_subscription_id)

    // Get the current subscription
    const subscription = await stripe.subscriptions.retrieve(company.stripe_subscription_id)

    if (!subscription || subscription.status !== 'active') {
      throw new Error('Subscription is not active')
    }

    console.log('Updating subscription with new pricing...')

    // Determine which pricing tier to use based on seat count
    let selectedTier;
    if (newSeatCount <= 14) {
      selectedTier = PRICING_TIERS.STANDARD;
    } else if (newSeatCount <= 29) {
      selectedTier = PRICING_TIERS.TEAM;
    } else {
      selectedTier = PRICING_TIERS.ENTERPRISE;
    }

    console.log('Selected tier:', selectedTier);
    console.log('Quantity:', newSeatCount);

    // Since we're using quantity-based pricing, we need to create a new price with VAT included
    // Calculate the price per seat INCLUDING VAT
    const vatRate = 0.2; // 20% VAT for UK
    const pricePerSeatPreVat = selectedTier.pricePerSeat * 100; // Convert to pence
    const vatAmount = Math.round(pricePerSeatPreVat * vatRate);
    const pricePerSeatWithVat = pricePerSeatPreVat + vatAmount;

    console.log('Price per seat (pre-VAT):', selectedTier.pricePerSeat);
    console.log('Price per seat with VAT (pence):', pricePerSeatWithVat);

    // Create a new price with VAT included for this subscription update
    const stripePriceWithVat = await stripe.prices.create({
      currency: 'gbp',
      unit_amount: pricePerSeatWithVat,
      recurring: { interval: 'month' },
      product: selectedTier.productId,
    });

    // Update the subscription with the new price and quantity
    const updatedSubscription = await stripe.subscriptions.update(
      company.stripe_subscription_id,
      {
        items: [{
          id: subscription.items.data[0].id,
          price: stripePriceWithVat.id,
          quantity: newSeatCount
        }],
        proration_behavior: 'always_invoice', // Create prorated charges/credits
        metadata: {
          seat_count: newSeatCount.toString(),
          price_per_month: newPrice.toString()
        }
      }
    )

    console.log('Subscription updated successfully:', updatedSubscription.id)

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        subscription: {
          id: updatedSubscription.id,
          status: updatedSubscription.status,
          current_period_end: updatedSubscription.current_period_end
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

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