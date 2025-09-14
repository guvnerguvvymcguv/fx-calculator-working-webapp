// supabase/functions/create-checkout-session/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.18.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Check if Stripe key exists
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY not configured')
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
    })

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the user
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      throw new Error('No user found')
    }

    const { companyId, billingPeriod, seatCount, pricePerMonth } = await req.json()

    console.log('Checkout request:', { companyId, billingPeriod, seatCount, pricePerMonth })

    // Get company details
    const { data: company, error: companyError } = await supabaseClient
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single()

    if (companyError) {
      throw new Error(`Company fetch error: ${companyError.message}`)
    }

    if (!company) {
      throw new Error('Company not found')
    }

    // Calculate prices
    const monthlyAmount = pricePerMonth * 100 // Convert to pence
    const annualAmount = pricePerMonth * 12 * 0.9 * 100 // 10% discount for annual

    // Create or get Stripe customer
    let customerId = company.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
          company_id: companyId,
          company_name: company.name
        }
      })
      customerId = customer.id

      // Save Stripe customer ID to database
      const { error: updateError } = await supabaseClient
        .from('companies')
        .update({ stripe_customer_id: customerId })
        .eq('id', companyId)

      if (updateError) {
        console.error('Failed to save customer ID:', updateError)
      }
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: `SpreadChecker ${billingPeriod === 'annual' ? 'Annual' : 'Monthly'} Subscription`,
              description: `${seatCount} seats (${company.admin_seats || 0} admin, ${company.junior_seats || 0} junior)`,
            },
            unit_amount: billingPeriod === 'annual' ? annualAmount : monthlyAmount,
            recurring: billingPeriod === 'monthly' ? {
              interval: 'month'
            } : undefined
          },
          quantity: 1,
        },
      ],
      mode: billingPeriod === 'annual' ? 'payment' : 'subscription',
      allow_promotion_codes: true,
      success_url: `${req.headers.get('origin')}/admin?checkout=success`,
      cancel_url: `${req.headers.get('origin')}/checkout?canceled=true`,
      metadata: {
        company_id: companyId,
        seat_count: seatCount.toString(),
        billing_period: billingPeriod,
        price_per_month: pricePerMonth.toString()
      }
    })

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Checkout error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})