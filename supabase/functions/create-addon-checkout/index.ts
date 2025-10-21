// supabase/functions/create-addon-checkout/index.ts
// Creates a Stripe Checkout session for prorated add-on payment, then adds subscription item

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ADDON_PRODUCTS = {
  COMPANY_FINDER: 'prod_TGoy9y2EU095hl',
  CLIENT_DATA: 'prod_TGozIi5v2P0dK5'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      throw new Error('Stripe configuration error')
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      typescript: true,
    })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
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

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    
    if (userError || !user) {
      throw new Error('Authentication required')
    }

    const body = await req.json()
    const { companyId, addonType } = body
    
    console.log('Create addon checkout request:', { companyId, addonType, userId: user.id })

    if (!companyId || !addonType) {
      throw new Error('Missing required parameters')
    }

    // Get company details
    const { data: company, error: companyError } = await supabaseClient
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      throw new Error('Company not found')
    }

    if (!company.stripe_customer_id) {
      throw new Error('No Stripe customer found')
    }

    if (!company.stripe_subscription_id) {
      throw new Error('No active subscription found')
    }

    // Fetch the subscription to get current period dates
    const subscription = await stripe.subscriptions.retrieve(company.stripe_subscription_id)
    
    const currentPeriodStart = new Date(subscription.current_period_start * 1000)
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000)
    const now = new Date()
    
    // Calculate days remaining in current period
    const totalDaysInPeriod = Math.ceil((currentPeriodEnd.getTime() - currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24))
    const daysRemaining = Math.ceil((currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    console.log('Proration calculation:', {
      currentPeriodStart: currentPeriodStart.toISOString(),
      currentPeriodEnd: currentPeriodEnd.toISOString(),
      totalDaysInPeriod,
      daysRemaining,
      subscriptionType: company.subscription_type
    })

    // Determine product ID
    const productId = addonType === 'company_finder' 
      ? ADDON_PRODUCTS.COMPANY_FINDER 
      : ADDON_PRODUCTS.CLIENT_DATA

    // Calculate pricing PER SEAT based on subscription type
    const seatCount = company.subscription_seats || 1

    let addonPricePerSeatExVat: number
    let fullPeriodPriceExVat: number
    let recurringInterval: 'month' | 'year'

    if (company.subscription_type === 'annual') {
      // Annual: £3/seat/month = £36/seat/year with 10% discount = £32.40/seat/year
      const addonPricePerSeatPerMonth = 3
      const annualPricePerSeat = addonPricePerSeatPerMonth * 12 // £36/seat/year
      addonPricePerSeatExVat = annualPricePerSeat * 0.9 // 10% annual discount = £32.40/seat/year
      fullPeriodPriceExVat = addonPricePerSeatExVat * seatCount
      recurringInterval = 'year'
    } else {
      // Monthly: £5/seat/month
      addonPricePerSeatExVat = 5
      fullPeriodPriceExVat = addonPricePerSeatExVat * seatCount
      recurringInterval = 'month'
    }

    // Calculate prorated amount for remainder of period (excluding VAT)
    const proratedAmountExVat = (fullPeriodPriceExVat * daysRemaining) / totalDaysInPeriod
    
    // Add VAT (20%)
    const proratedAmountWithVat = proratedAmountExVat * 1.2
    const proratedAmountPence = Math.round(proratedAmountWithVat * 100)
    
    // Calculate ongoing price with VAT
    const addonPricePerSeatWithVatPence = Math.round(addonPricePerSeatExVat * 1.2 * 100)

    console.log('Pricing calculation:', {
      addonPricePerSeatExVat,
      fullPeriodPriceExVat,
      proratedAmountExVat,
      proratedAmountWithVat,
      proratedAmountPence,
      addonPricePerSeatWithVatPence,
      seatCount
    })

    // Create price for ongoing billing (per seat with VAT)
    const ongoingPrice = await stripe.prices.create({
      currency: 'gbp',
      unit_amount: addonPricePerSeatWithVatPence,
      recurring: { interval: recurringInterval },
      product: productId
    })

    console.log('Created ongoing price:', ongoingPrice.id)

    // Calculate new total monthly price for Supabase
    // We'll fetch the current price in the webhook and add the add-on price
    const addonMonthlyPricePerSeat = company.subscription_type === 'annual' 
      ? (3 * 12 * 0.9) / 12 // £32.40/year = £2.70/month equivalent
      : 5 // £5/month

    console.log('Add-on pricing for metadata:', {
      addonMonthlyPricePerSeat,
      seatCount,
      addonMonthlyTotal: addonMonthlyPricePerSeat * seatCount
    })

    // Get origin URL
    const origin = req.headers.get('origin') || 'https://spreadchecker.co.uk'
    
    const addonName = addonType === 'company_finder' ? 'Company Finder' : 'Client Data Tracking'

    // Create checkout session for prorated payment
    const session = await stripe.checkout.sessions.create({
      customer: company.stripe_customer_id,
      payment_method_types: ['card'],
      mode: 'payment',
      payment_method_options: {
        card: {
          request_three_d_secure: 'any', // Enforce 3D Secure
        },
      },
      success_url: `${origin}/admin/account?addon_added=success`,
      cancel_url: `${origin}/admin/account?addon_cancelled=true`,
      metadata: {
        company_id: companyId,
        addon_type: addonType,
        user_id: user.id,
        is_addon_proration: 'true',
        ongoing_price_id: ongoingPrice.id,
        seat_count: seatCount.toString(),
        subscription_id: company.stripe_subscription_id,
        addon_monthly_price_per_seat: addonMonthlyPricePerSeat.toString()
      },
      line_items: [{
        price_data: {
          currency: 'gbp',
          product_data: {
            name: `${addonName} - Prorated for ${daysRemaining} days`,
            description: `${addonName} add-on for ${seatCount} seat${seatCount > 1 ? 's' : ''} (${daysRemaining} days remaining in current ${recurringInterval})`,
          },
          unit_amount: proratedAmountPence,
        },
        quantity: 1,
      }]
    })

    if (!session.url) {
      throw new Error('No checkout URL received from Stripe')
    }

    console.log('Checkout session created:', {
      sessionId: session.id,
      proratedCharge: proratedAmountPence / 100,
      ongoingPriceId: ongoingPrice.id
    })

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

  } catch (error) {
    console.error('Create addon checkout error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
