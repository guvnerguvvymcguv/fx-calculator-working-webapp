// supabase/functions/manage-addon/index.ts
// Enables or disables add-ons for a subscription (monthly plans only)

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
    const { companyId, addonType, enabled } = body
    
    console.log('Manage addon request:', { companyId, addonType, enabled, userId: user.id })

    if (!companyId || !addonType || enabled === undefined) {
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

    // Only allow toggling for monthly subscriptions
    if (company.subscription_type === 'annual') {
      throw new Error('Add-ons are included free with annual subscriptions and cannot be toggled')
    }

    if (!company.stripe_subscription_id) {
      throw new Error('No active subscription found')
    }

    // Get the subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(company.stripe_subscription_id)

    if (enabled) {
      // ENABLE ADD-ON: Add subscription item
      console.log('Enabling add-on:', addonType)
      
      // Determine which product to add
      const productId = addonType === 'company_finder' 
        ? ADDON_PRODUCTS.COMPANY_FINDER 
        : ADDON_PRODUCTS.CLIENT_DATA

      // Calculate per-seat pricing based on subscription type
      const seatCount = company.subscription_seats || 1;
      let addonPricePerSeat: number;
      let recurringInterval: 'month' | 'year';
      
      if (company.subscription_type === 'annual') {
        // Annual: £3/seat/month = £36/seat/year with 10% discount
        addonPricePerSeat = 3;
        const annualPricePerSeat = addonPricePerSeat * 12; // £36/seat/year
        const subtotal = annualPricePerSeat * seatCount;
        const withDiscount = subtotal * 0.9; // 10% annual discount
        const withVat = withDiscount * 1.2; // 20% VAT
        const addonWithVatPence = Math.round(withVat * 100);
        recurringInterval = 'year';
        
        const addonPrice = await stripe.prices.create({
          currency: 'gbp',
          unit_amount: addonWithVatPence,
          recurring: { interval: recurringInterval },
          product: productId
        });

        // Add to subscription without proration (charge starts next billing cycle)
        await stripe.subscriptionItems.create({
          subscription: company.stripe_subscription_id,
          price: addonPrice.id,
          quantity: 1,
          proration_behavior: 'none'
        });
      } else {
        // Monthly: £5/seat/month
        addonPricePerSeat = 5;
        const subtotal = addonPricePerSeat * seatCount;
        const withVat = subtotal * 1.2; // 20% VAT
        const addonWithVatPence = Math.round(withVat * 100);
        recurringInterval = 'month';
        
        const addonPrice = await stripe.prices.create({
          currency: 'gbp',
          unit_amount: addonWithVatPence,
          recurring: { interval: recurringInterval },
          product: productId
        });

        // Add to subscription without proration (charge starts next billing cycle)
        await stripe.subscriptionItems.create({
          subscription: company.stripe_subscription_id,
          price: addonPrice.id,
          quantity: 1,
          proration_behavior: 'none'
        });
      }

      // Update database
      const updateField = addonType === 'company_finder' 
        ? 'company_finder_enabled' 
        : 'client_data_enabled'

      await supabaseClient
        .from('companies')
        .update({
          [updateField]: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', companyId)

      console.log(`Add-on ${addonType} enabled for company ${companyId}`)

    } else {
      // DISABLE ADD-ON: Remove subscription item
      console.log('Disabling add-on:', addonType)
      
      // Find the subscription item for this add-on
      const productId = addonType === 'company_finder' 
        ? ADDON_PRODUCTS.COMPANY_FINDER 
        : ADDON_PRODUCTS.CLIENT_DATA

      const itemToRemove = subscription.items.data.find(item => {
        return (item.price as any).product === productId
      })

      if (itemToRemove) {
        // Remove the subscription item without proration (no refund)
        await stripe.subscriptionItems.del(
          itemToRemove.id,
          {
            proration_behavior: 'none'
          }
        )
      }

      // Update database
      const updateField = addonType === 'company_finder' 
        ? 'company_finder_enabled' 
        : 'client_data_enabled'

      await supabaseClient
        .from('companies')
        .update({
          [updateField]: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', companyId)

      console.log(`Add-on ${addonType} disabled for company ${companyId}`)
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Manage addon error:', error)
    
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
