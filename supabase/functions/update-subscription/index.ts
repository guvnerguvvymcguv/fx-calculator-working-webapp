import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  // Initialize Supabase client
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { companyId, newSeatCount } = await req.json();
  
  // Get company's Stripe subscription ID from database
  const { data: company } = await supabase
    .from('companies')
    .select('stripe_subscription_id, subscription_type')
    .eq('id', companyId)
    .single();

  if (company.subscription_type === 'annual') {
    // For annual subscriptions, just update the database
    // They've already paid for the year
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Annual subscription - no charge adjustment needed' 
    }));
  }

  // Calculate new price
  const pricePerSeat = newSeatCount <= 14 ? 30 : newSeatCount <= 29 ? 27 : 24;
  const newMonthlyPrice = newSeatCount * pricePerSeat;

  // Get the current subscription first
  const subscription = await stripe.subscriptions.retrieve(company.stripe_subscription_id);

  // Update Stripe subscription
  const updatedSubscription = await stripe.subscriptions.update(
    company.stripe_subscription_id,
    {
      items: [{
        id: subscription.items.data[0].id,
        quantity: newSeatCount,
      }],
      proration_behavior: 'always_invoice', // Charge/credit immediately
    }
  );

  return new Response(JSON.stringify({ success: true, subscription: updatedSubscription }));
});