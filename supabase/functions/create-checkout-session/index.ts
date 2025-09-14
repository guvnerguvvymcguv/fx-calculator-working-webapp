// supabase/functions/create-checkout-session/index.ts

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
    const { companyId, billingPeriod, seatCount, pricePerMonth } = body
    
    console.log('Checkout request:', { 
      companyId, 
      billingPeriod, 
      seatCount, 
      pricePerMonth,
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

    // Calculate prices (convert pounds to pence)
    const monthlyAmount = Math.round(pricePerMonth * 100)
    const annualAmount = Math.round(pricePerMonth * 12 * 0.9 * 100) // 10% discount

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
          // Continue anyway - customer is created in Stripe
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
    
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      payment_method_types: ['card'],
      mode: billingPeriod === 'monthly' ? 'subscription' : 'payment',
      success_url: `${origin}/admin?checkout=success`,
      cancel_url: `${origin}/checkout?canceled=true`,
      metadata: {
        company_id: companyId,
        seat_count: seatCount.toString(),
        billing_period: billingPeriod,
        price_per_month: pricePerMonth.toString(),
        user_id: user.id
      },
      line_items: billingPeriod === 'monthly' 
        ? [{
            price_data: {
              currency: 'gbp',
              product_data: {
                name: 'SpreadChecker Monthly Subscription',
                description: `${seatCount} total seats (${company.admin_seats || 0} admin, ${company.junior_seats || 0} junior)`,
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
                description: `${seatCount} total seats for 12 months (${company.admin_seats || 0} admin, ${company.junior_seats || 0} junior)`,
              },
              unit_amount: annualAmount,
            },
            quantity: 1,
          }]
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