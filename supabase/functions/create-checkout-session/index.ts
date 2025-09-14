// supabase/functions/create-checkout-session/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY not configured')
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      typescript: true,
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

    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      throw new Error('No user found')
    }

    const body = await req.json()
    const { companyId, billingPeriod, seatCount, pricePerMonth } = body

    // Get company details
    const { data: company } = await supabaseClient
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single()

    if (!company) {
      throw new Error('Company not found')
    }

    // Calculate prices (in pence)
    const monthlyAmount = Math.round(pricePerMonth * 100)
    const annualAmount = Math.round(pricePerMonth * 12 * 0.9 * 100)

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

      // Save customer ID
      await supabaseClient
        .from('companies')
        .update({ stripe_customer_id: customerId })
        .eq('id', companyId)
    }

    // Create the line items based on billing period
    const lineItems = billingPeriod === 'monthly' 
      ? [{
          price_data: {
            currency: 'gbp',
            product_data: {
              name: 'SpreadChecker Monthly Subscription',
              description: `${seatCount} seats`,
            },
            unit_amount: monthlyAmount,
            recurring: {
              interval: 'month' as const
            }
          },
          quantity: 1,
        }]
      : [{
          price_data: {
            currency: 'gbp',
            product_data: {
              name: 'SpreadChecker Annual Subscription',
              description: `${seatCount} seats for 12 months`,
            },
            unit_amount: annualAmount,
          },
          quantity: 1,
        }]

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: billingPeriod === 'monthly' ? 'subscription' : 'payment',
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
    console.error('Error in create-checkout-session:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})