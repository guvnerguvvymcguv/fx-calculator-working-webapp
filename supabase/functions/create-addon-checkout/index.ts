// supabase/functions/create-addon-checkout/index.ts
// Creates a Stripe Checkout session for adding an add-on to an existing subscription

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

    // Determine product ID
    const productId = addonType === 'company_finder' 
      ? ADDON_PRODUCTS.COMPANY_FINDER 
      : ADDON_PRODUCTS.CLIENT_DATA

    // Calculate pricing based on subscription type and seat count
    const seatCount = company.subscription_seats || 1
    const vatRate = 0.2

    let addonPriceWithVatPence: number
    let recurringInterval: 'month' | 'year'

    if (company.subscription_type === 'annual') {
      // Annual: £3/seat/month = £36/seat/year with 10% discount
      const addonPricePerSeat = 3
      const annualPricePerSeat = addonPricePerSeat * 12 // £36/seat/year
      const subtotal = annualPricePerSeat * seatCount
      const withDiscount = subtotal * 0.9 // 10% annual discount
      const withVat = withDiscount * 1.2 // 20% VAT
      addonPriceWithVatPence = Math.round(withVat * 100)
      recurringInterval = 'year'
    } else {
      // Monthly: £5/seat/month
      const addonPricePerSeat = 5
      const subtotal = addonPricePerSeat * seatCount
      const withVat = subtotal * 1.2 // 20% VAT
      addonPriceWithVatPence = Math.round(withVat * 100)
      recurringInterval = 'month'
    }

    // Create price for add-on
    const addonPrice = await stripe.prices.create({
      currency: 'gbp',
      unit_amount: addonPriceWithVatPence,
      recurring: { interval: recurringInterval },
      product: productId
    })

    // Get origin URL
    const origin = req.headers.get('origin') || 'https://spreadchecker.co.uk'

    // Create checkout session for add-on
    const session = await stripe.checkout.sessions.create({
      customer: company.stripe_customer_id,
      payment_method_types: ['card'],
      mode: 'subscription',
      payment_method_options: {
        card: {
          request_three_d_secure: 'any',
        },
      },
      success_url: `${origin}/admin/account?addon_added=success`,
      cancel_url: `${origin}/admin/account?addon_cancelled=true`,
      metadata: {
        company_id: companyId,
        addon_type: addonType,
        user_id: user.id,
        is_addon_purchase: 'true'
      },
      line_items: [{
        price: addonPrice.id,
        quantity: 1
      }]
    })

    if (!session.url) {
      throw new Error('No checkout URL received from Stripe')
    }

    console.log('Addon checkout session created:', session.id)

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
