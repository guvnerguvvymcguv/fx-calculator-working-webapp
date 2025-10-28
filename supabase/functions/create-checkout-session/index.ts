// supabase/functions/create-checkout-session/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Add-on Price IDs
const ADDON_PRICES = {
  COMPANY_FINDER: 'price_1SKHKc5du1W5ijSGJa7hlPNZ', // £5/month
  CLIENT_DATA: 'price_1SKHM05du1W5ijSGdWEkhTHP' // £5/month
}

// Define pricing tiers with Stripe price IDs and product IDs
// Tier ranges: 1-5 (Standard), 6-12 (Team), 13+ (Enterprise)
const PRICING_TIERS = {
  STANDARD: { 
    productId: 'prod_T8XJnL61gY927i',
    annualProductId: 'prod_TCLns1si1ulZ4p',
    priceId: 'price_1SCGF55du1W5ijSGxcs7zQQX', 
    maxSeats: 5,
    pricePerSeat: 30 // Pre-VAT price
  },
  TEAM: { 
    productId: 'prod_T8XMTp9qKMSyVh',
    annualProductId: 'prod_TCLoT9ndmjiSkW',
    priceId: 'price_1SCGHX5du1W5ijSGSx4iqFXi', 
    maxSeats: 12,
    pricePerSeat: 27 // Pre-VAT price
  },
  ENTERPRISE: { 
    productId: 'prod_T8XNn9mRSDskk7',
    annualProductId: 'prod_TCLqYrus5QQlKi',
    priceId: 'price_1SCGIk5du1W5ijSG3jIFMf9L', 
    maxSeats: null,
    pricePerSeat: 24 // Pre-VAT price
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
    const { 
      companyId, 
      billingPeriod, 
      seatCount, 
      pricePerMonth, 
      adminSeats, 
      juniorSeats,
      companyFinderEnabled = false,
      clientDataEnabled = false
    } = body
    
    console.log('Checkout request:', { 
      companyId, 
      billingPeriod, 
      seatCount, 
      pricePerMonth,
      adminSeats,
      juniorSeats,
      companyFinderEnabled,
      clientDataEnabled,
      userId: user.id 
    })

    // Validate input
    if (!companyId || !billingPeriod || !seatCount || !pricePerMonth) {
      throw new Error('Missing required checkout parameters')
    }

    // Get company details
    const { data: company, error: companyError } = await supabaseClient
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single()

    if (companyError) {
      console.error('Company fetch error:', companyError)
      throw new Error('Company not found')
    }

    if (!company) {
      throw new Error('Company data not found')
    }

    // Check if this is a resubscription (company already had a trial)
    const isResubscription = company.trial_ends_at !== null;
    if (isResubscription) {
      console.log('Resubscription detected - no trial period will be applied');
    }

    // Determine which pricing tier to use based on seat count
    let selectedTier;
    if (seatCount <= 5) {
      selectedTier = PRICING_TIERS.STANDARD;
    } else if (seatCount <= 12) {
      selectedTier = PRICING_TIERS.TEAM;
    } else {
      selectedTier = PRICING_TIERS.ENTERPRISE;
    }

    console.log('Selected tier:', selectedTier);
    console.log('Seat count:', seatCount);

    // Create or retrieve Stripe customer
    let customerId = company.stripe_customer_id

    if (!customerId) {
      console.log('Creating new Stripe customer for company:', company.name)
      
      try {
        const customer = await stripe.customers.create({
          email: user.email!,
          metadata: {
            supabase_user_id: user.id,
            company_id: companyId,
            company_name: company.name || 'Unknown Company'
          }
        })
        
        customerId = customer.id
        console.log('Created Stripe customer:', customerId)

        // Save customer ID to database
        const { error: updateError } = await supabaseClient
          .from('companies')
          .update({ stripe_customer_id: customerId })
          .eq('id', companyId)

        if (updateError) {
          console.error('Failed to save customer ID:', updateError)
        }
      } catch (stripeError) {
        console.error('Stripe customer creation failed:', stripeError)
        throw new Error('Failed to create customer in Stripe')
      }
    }

    // Get the origin URL (with fallback)
    const origin = req.headers.get('origin') || 'https://spreadchecker.co.uk'
    
    // Create Stripe checkout session
    console.log('Creating checkout session...')

    // Calculate VAT
    const vatRate = 0.2; // 20% VAT
    
    // For annual billing
    const annualDiscount = 0.9; // 10% discount
    const annualSubtotal = selectedTier.pricePerSeat * seatCount * 12 * annualDiscount;
    const annualVat = annualSubtotal * vatRate;
    const annualTotal = annualSubtotal + annualVat;

    let sessionConfig: Stripe.Checkout.SessionCreateParams;

    if (billingPeriod === 'monthly') {
      // For monthly subscriptions, create a price with VAT for the existing product
      const vatAmount = Math.round(selectedTier.pricePerSeat * 100 * vatRate);
      const priceWithVatPence = Math.round(selectedTier.pricePerSeat * 100) + vatAmount;

      // Create a new price attached to the EXISTING product (not creating a new product)
      const priceWithVat = await stripe.prices.create({
        currency: 'gbp',
        unit_amount: priceWithVatPence,
        recurring: { interval: 'month' },
        product: selectedTier.productId // Use existing product ID instead of product_data
      });

      sessionConfig = {
  customer: customerId,
  payment_method_types: ['card'],
  mode: 'subscription',
  payment_method_options: {
    card: {
      request_three_d_secure: 'any',  // ← ENFORCE 3D SECURE
    },
  },
  success_url: `${origin}/admin?checkout=success`,
  cancel_url: `${origin}/checkout?canceled=true`,
  metadata: {
    company_id: companyId,
    seat_count: seatCount.toString(),
    admin_seats: (adminSeats || company.admin_seats || 0).toString(),
    junior_seats: (juniorSeats || company.junior_seats || 0).toString(),
    billing_period: billingPeriod,
    price_per_month: pricePerMonth.toString(),
    user_id: user.id,
    company_finder_enabled: companyFinderEnabled.toString(),
    client_data_enabled: clientDataEnabled.toString()
  },
  line_items: [{
    price: priceWithVat.id,
    quantity: seatCount
  }]
};

// Add add-ons to line items (only for monthly subscriptions)
if (billingPeriod === 'monthly') {
  if (companyFinderEnabled) {
    // Add Company Finder add-on: £5 per seat per month
    const addonPricePerSeat = 5; // £5/seat/month
    const addonSubtotal = addonPricePerSeat * seatCount; // £5 × seats
    const addonVat = Math.round(addonSubtotal * 100 * vatRate); // 20% VAT
    const addonWithVatPence = Math.round(addonSubtotal * 100) + addonVat;
    
    const companyFinderPrice = await stripe.prices.create({
      currency: 'gbp',
      unit_amount: addonWithVatPence,
      recurring: { interval: 'month' },
      product: 'prod_TGoy9y2EU095hl'
    });
    
    sessionConfig.line_items!.push({
      price: companyFinderPrice.id,
      quantity: 1 // Price already multiplied by seat count
    });
  }
  
  if (clientDataEnabled) {
    // Add Client Data add-on: £5 per seat per month
    const addonPricePerSeat = 5; // £5/seat/month
    const addonSubtotal = addonPricePerSeat * seatCount; // £5 × seats
    const addonVat = Math.round(addonSubtotal * 100 * vatRate); // 20% VAT
    const addonWithVatPence = Math.round(addonSubtotal * 100) + addonVat;
    
    const clientDataPrice = await stripe.prices.create({
      currency: 'gbp',
      unit_amount: addonWithVatPence,
      recurring: { interval: 'month' },
      product: 'prod_TGozIi5v2P0dK5'
    });
    
    sessionConfig.line_items!.push({
      price: clientDataPrice.id,
      quantity: 1 // Price already multiplied by seat count
    });
  }
}

// No need to reassign sessionConfig here, it's already properly typed

    } else {
      // For annual subscriptions, create a recurring subscription with annual interval
      const annualPricePerSeat = selectedTier.pricePerSeat * 12; // £360/year
      const annualPriceWithDiscount = annualPricePerSeat * 0.9; // Apply 10% discount: £324/year
      const vatAmount = Math.round(annualPriceWithDiscount * 100 * vatRate);
      const priceWithVatPence = Math.round(annualPriceWithDiscount * 100) + vatAmount;
      
      // Create an annual price for the selected tier
      const annualPrice = await stripe.prices.create({
        currency: 'gbp',
        unit_amount: priceWithVatPence,
        recurring: { 
          interval: 'year',  // Annual billing
          interval_count: 1 
        },
        product: selectedTier.annualProductId
      });

      sessionConfig = {
  customer: customerId,
  payment_method_types: ['card'],
  mode: 'subscription',
  payment_method_options: {
    card: {
      request_three_d_secure: 'any',  // ← ENFORCE 3D SECURE
    },
  },
  success_url: `${origin}/admin?checkout=success`,
  cancel_url: `${origin}/checkout?canceled=true`,
  metadata: {
    company_id: companyId,
    seat_count: seatCount.toString(),
    admin_seats: (adminSeats || company.admin_seats || 0).toString(),
    junior_seats: (juniorSeats || company.junior_seats || 0).toString(),
    billing_period: billingPeriod,
    price_per_month: pricePerMonth.toString(),
    user_id: user.id,
    company_finder_enabled: companyFinderEnabled.toString(),
    client_data_enabled: clientDataEnabled.toString()
  },
  line_items: [{
    price: annualPrice.id,
    quantity: seatCount
  }]
};

// For annual subscriptions, add add-ons at £3 per seat per month (£36/seat/year)
if (companyFinderEnabled) {
  // Company Finder: £3/seat/month = £36/seat/year
  const addonPricePerSeatPerMonth = 3; // £3/seat/month
  const addonPricePerSeatPerYear = addonPricePerSeatPerMonth * 12; // £36/seat/year
  const addonSubtotal = addonPricePerSeatPerYear * seatCount; // £36 × seats
  const addonWithDiscount = addonSubtotal * 0.9; // 10% annual discount
  const addonVat = Math.round(addonWithDiscount * 100 * vatRate); // 20% VAT
  const addonWithVatPence = Math.round(addonWithDiscount * 100) + addonVat;
  
  const companyFinderAnnualPrice = await stripe.prices.create({
    currency: 'gbp',
    unit_amount: addonWithVatPence,
    recurring: { 
      interval: 'year',
      interval_count: 1 
    },
    product: 'prod_TGoy9y2EU095hl'
  });
  
  sessionConfig.line_items!.push({
    price: companyFinderAnnualPrice.id,
    quantity: 1 // Price already multiplied by seat count
  });
}

if (clientDataEnabled) {
  // Client Data: £3/seat/month = £36/seat/year
  const addonPricePerSeatPerMonth = 3; // £3/seat/month
  const addonPricePerSeatPerYear = addonPricePerSeatPerMonth * 12; // £36/seat/year
  const addonSubtotal = addonPricePerSeatPerYear * seatCount; // £36 × seats
  const addonWithDiscount = addonSubtotal * 0.9; // 10% annual discount
  const addonVat = Math.round(addonWithDiscount * 100 * vatRate); // 20% VAT
  const addonWithVatPence = Math.round(addonWithDiscount * 100) + addonVat;
  
  const clientDataAnnualPrice = await stripe.prices.create({
    currency: 'gbp',
    unit_amount: addonWithVatPence,
    recurring: { 
      interval: 'year',
      interval_count: 1 
    },
    product: 'prod_TGozIi5v2P0dK5'
  });
  
  sessionConfig.line_items!.push({
    price: clientDataAnnualPrice.id,
    quantity: 1 // Price already multiplied by seat count
  });
}
    }

    try {
      const session = await stripe.checkout.sessions.create(sessionConfig)
      
      if (!session.url) {
        throw new Error('No checkout URL received from Stripe')
      }

      console.log('Checkout session created successfully:', session.id)

      // Return the checkout URL
      return new Response(
        JSON.stringify({ 
          url: session.url,
          sessionId: session.id 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    } catch (stripeError) {
      console.error('Stripe session creation failed:', stripeError)
      throw new Error(`Stripe error: ${stripeError instanceof Error ? stripeError.message : 'Unknown error'}`)
    }

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