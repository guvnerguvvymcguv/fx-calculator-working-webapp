// supabase/functions/create-seat-update-payment/index.ts
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
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2023-10-16',
    })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { companyId, newSeatCount, currentSeatCount, subscriptionType } = await req.json()
    
    console.log('Seat update payment request:', {
      companyId,
      newSeatCount,
      currentSeatCount,
      subscriptionType
    })
    
    // Get company and subscription details
    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single()

    if (!company) {
      throw new Error('Company not found')
    }

    // Calculate pro-rata amount
    const subscription = await stripe.subscriptions.retrieve(company.stripe_subscription_id)
    const seatDifference = newSeatCount - currentSeatCount
    
    // Calculate remaining time in period
    const now = Math.floor(Date.now() / 1000)
    const periodEnd = subscription.current_period_end
    const periodStart = subscription.current_period_start
    const totalPeriodSeconds = periodEnd - periodStart
    const remainingSeconds = periodEnd - now
    const proRataPercentage = remainingSeconds / totalPeriodSeconds

    // Convert to days for display
    const remainingDays = remainingSeconds / (60 * 60 * 24)
    
    // Determine pricing tier based on NEW seat count
    let pricePerSeat = 30 // Default to standard tier
    if (newSeatCount <= 14) {
      pricePerSeat = 30
    } else if (newSeatCount <= 29) {
      pricePerSeat = 27
    } else {
      pricePerSeat = 24
    }

    console.log('Pricing calculation:', {
      pricePerSeat,
      seatDifference,
      remainingDays: Math.round(remainingDays),
      proRataPercentage: (proRataPercentage * 100).toFixed(2) + '%'
    })

    // Calculate the pro-rata amount based on subscription type
    let proRataAmount = 0
    let periodDescription = ''
    
    if (subscriptionType === 'annual' || company.subscription_type === 'annual') {
      // Annual subscription pro-rata calculation
      const annualPricePerSeat = pricePerSeat * 12 * 0.9 // Annual gets 10% discount
      const pricePerSeatWithVat = annualPricePerSeat * 1.2 // Add 20% VAT
      proRataAmount = Math.round(seatDifference * pricePerSeatWithVat * proRataPercentage * 100) // Convert to pence
      
      const remainingMonths = Math.round(remainingDays / 30)
      periodDescription = `${remainingMonths} month${remainingMonths !== 1 ? 's' : ''} remaining in annual subscription`
      
      console.log('Annual calculation:', {
        annualPricePerSeat,
        pricePerSeatWithVat,
        proRataAmount: proRataAmount / 100, // Display in pounds
        periodDescription
      })
    } else {
      // Monthly subscription pro-rata calculation
      const monthlyPriceWithVat = pricePerSeat * 1.2 // Add 20% VAT
      proRataAmount = Math.round(seatDifference * monthlyPriceWithVat * proRataPercentage * 100) // Convert to pence
      
      periodDescription = `${Math.round(remainingDays)} day${Math.round(remainingDays) !== 1 ? 's' : ''} remaining in current month`
      
      console.log('Monthly calculation:', {
        monthlyPriceWithVat,
        proRataAmount: proRataAmount / 100, // Display in pounds
        periodDescription
      })
    }

    // Ensure minimum charge of £1 to avoid Stripe errors
    if (proRataAmount < 100) {
      proRataAmount = 100 // Minimum £1
    }

    // Create checkout session for the pro-rata payment
    const session = await stripe.checkout.sessions.create({
      customer: company.stripe_customer_id,
      payment_method_types: ['card'],
      mode: 'payment',
      success_url: `${req.headers.get('origin')}/admin?seat_update=success&seats=${newSeatCount}`,
      cancel_url: `${req.headers.get('origin')}/admin/account`,
      line_items: [{
        price_data: {
          currency: 'gbp',
          product_data: {
            name: `Additional ${seatDifference} seat${seatDifference !== 1 ? 's' : ''} - Pro-rata charge`,
            description: periodDescription,
          },
          unit_amount: proRataAmount,
        },
        quantity: 1,
      }],
      metadata: {
        company_id: companyId,
        seat_update: 'true',
        new_seat_count: newSeatCount.toString(),
        old_seat_count: currentSeatCount.toString(),
        subscription_id: company.stripe_subscription_id,
        subscription_type: subscriptionType || company.subscription_type
      }
    })

    console.log('Checkout session created:', session.id)

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error creating seat update payment:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})