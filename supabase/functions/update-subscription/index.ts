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
    annualProductId: 'prod_TCLns1si1ulZ4p',
    priceId: 'price_1SCGF55du1W5ijSGxcs7zQQX', 
    maxSeats: 14,
    pricePerSeat: 30
  },
  TEAM: { 
    productId: 'prod_T8XMTp9qKMSyVh',
    annualProductId: 'prod_TCLoT9ndmjiSkW',
    priceId: 'price_1SCGHX5du1W5ijSGSx4iqFXi', 
    maxSeats: 29,
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

    // Handle annual subscriptions differently from monthly
    if (company.subscription_type === 'annual') {
      console.log('Processing annual subscription seat change');
      
      // For annual subscriptions, we need to calculate pro-rata charge
      // Get the current subscription to find the renewal date
      if (!company.stripe_subscription_id) {
        throw new Error('No active Stripe subscription found');
      }
      
      const subscription = await stripe.subscriptions.retrieve(company.stripe_subscription_id);
      
      if (!subscription || subscription.status !== 'active') {
        throw new Error('Subscription is not active');
      }

      // Get current seat count from subscription
      const currentSeatCount = subscription.items.data[0].quantity || 0;
      const seatDifference = newSeatCount - currentSeatCount;
      
      if (seatDifference === 0) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'No seat changes detected' 
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }

      // Calculate pro-rata amount for the remainder of the year
      const now = Math.floor(Date.now() / 1000);
      const periodEnd = subscription.current_period_end;
      const periodStart = subscription.current_period_start;
      const totalPeriodDays = (periodEnd - periodStart) / (60 * 60 * 24);
      const remainingDays = (periodEnd - now) / (60 * 60 * 24);
      const proRataPercentage = remainingDays / totalPeriodDays;

      console.log('Annual subscription details:', {
        currentSeats: currentSeatCount,
        newSeats: newSeatCount,
        seatDifference,
        totalPeriodDays: Math.round(totalPeriodDays),
        remainingDays: Math.round(remainingDays),
        proRataPercentage: proRataPercentage.toFixed(2)
      });

      // Determine pricing tier
      let selectedTier;
      if (newSeatCount <= 14) {
        selectedTier = PRICING_TIERS.STANDARD;
      } else if (newSeatCount <= 29) {
        selectedTier = PRICING_TIERS.TEAM;
      } else {
        selectedTier = PRICING_TIERS.ENTERPRISE;
      }

      // Calculate annual price per seat with VAT
      const vatRate = 0.2;
      const annualPricePerSeat = selectedTier.pricePerSeat * 12; // Annual price
      const pricePerSeatWithVat = annualPricePerSeat * (1 + vatRate);
      
      // Calculate pro-rata charge/credit for seat difference
      const proRataAmount = Math.round(seatDifference * pricePerSeatWithVat * proRataPercentage * 100); // in pence

      console.log('Pro-rata calculation:', {
        annualPricePerSeat,
        pricePerSeatWithVat: pricePerSeatWithVat.toFixed(2),
        proRataAmount: (proRataAmount / 100).toFixed(2)
      });

      if (seatDifference > 0) {
        // Adding seats - create an invoice item for the pro-rata charge
        await stripe.invoiceItems.create({
          customer: company.stripe_customer_id,
          amount: proRataAmount,
          currency: 'gbp',
          description: `Pro-rata charge for ${seatDifference} additional seat(s) (${Math.round(remainingDays)} days remaining)`,
          metadata: {
            company_id: companyId,
            seat_change: seatDifference.toString(),
            subscription_type: 'annual',
            pro_rata_days: Math.round(remainingDays).toString()
          }
        });

        // Create and finalize the invoice immediately
        const invoice = await stripe.invoices.create({
          customer: company.stripe_customer_id,
          auto_advance: true,
          description: `Seat adjustment for annual subscription`,
          metadata: {
            company_id: companyId,
            seat_change: seatDifference.toString()
          }
        });

        await stripe.invoices.finalizeInvoice(invoice.id);

        console.log('Pro-rata invoice created:', invoice.id);
      } else {
        // Removing seats - create a credit note for the pro-rata refund
        // Note: For annual, we apply credit to customer account balance
        const creditAmount = Math.abs(proRataAmount);
        
        await stripe.customers.createBalanceTransaction(company.stripe_customer_id, {
          amount: -creditAmount, // Negative amount = credit to customer
          currency: 'gbp',
          description: `Pro-rata credit for ${Math.abs(seatDifference)} removed seat(s) (${Math.round(remainingDays)} days remaining)`,
          metadata: {
            company_id: companyId,
            seat_change: seatDifference.toString(),
            subscription_type: 'annual'
          }
        });
        
        console.log('Pro-rata credit applied:', (creditAmount / 100).toFixed(2));
      }

      // Update the subscription quantity (no price change needed for annual)
      const updatedSubscription = await stripe.subscriptions.update(
        company.stripe_subscription_id,
        {
          items: [{
            id: subscription.items.data[0].id,
            quantity: newSeatCount
          }],
          proration_behavior: 'none', // We handled proration manually above
          metadata: {
            seat_count: newSeatCount.toString(),
            last_seat_change: new Date().toISOString()
          }
        }
      );

      console.log('Annual subscription updated successfully:', updatedSubscription.id);

      return new Response(
        JSON.stringify({ 
          success: true,
          subscription_type: 'annual',
          seat_change: seatDifference,
          pro_rata_amount: (proRataAmount / 100).toFixed(2),
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
      );
    }

    // Handle monthly subscriptions with Stripe's automatic proration
    if (company.subscription_type !== 'monthly') {
      console.log('Unknown subscription type')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Unknown subscription type - no adjustment made' 
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

    console.log('Retrieving monthly subscription:', company.stripe_subscription_id)

    // Get the current subscription
    const subscription = await stripe.subscriptions.retrieve(company.stripe_subscription_id)

    if (!subscription || subscription.status !== 'active') {
      throw new Error('Subscription is not active')
    }

    console.log('Updating monthly subscription with new pricing...')

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

    console.log('Monthly subscription updated successfully:', updatedSubscription.id)

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true,
        subscription_type: 'monthly',
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