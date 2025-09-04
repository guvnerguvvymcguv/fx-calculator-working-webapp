import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
apiVersion: '2025-08-27.basil' as const,
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // Need service key for admin access
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature']!;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      webhookSecret
    );

    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Extract quantity from line items
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
        const quantity = lineItems.data[0]?.quantity || 1;
        
        // Update or create company subscription
        await supabase
          .from('companies')
          .upsert({
            stripe_customer_id: session.customer as string,
            subscription_status: 'active',
            subscription_seats: quantity,
            trial_ends_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days
          })
          .eq('stripe_customer_id', session.customer);
        
        break;

      case 'customer.subscription.updated':
        const subscription = event.data.object as Stripe.Subscription;
        
        await supabase
          .from('companies')
          .update({
            subscription_status: subscription.status,
            subscription_seats: subscription.items.data[0]?.quantity || 0,
          })
          .eq('stripe_customer_id', subscription.customer);
        
        break;

      case 'customer.subscription.deleted':
        const deletedSub = event.data.object as Stripe.Subscription;
        
        await supabase
          .from('companies')
          .update({
            subscription_status: 'cancelled',
            subscription_seats: 0,
          })
          .eq('stripe_customer_id', deletedSub.customer);
        
        break;
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: 'Webhook handler failed' });
  }
}