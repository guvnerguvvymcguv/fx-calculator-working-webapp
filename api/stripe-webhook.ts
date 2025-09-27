// api/stripe-webhook.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // Need service key for admin access
);

// Disable body parsing, we need raw body for webhook signature
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to get raw body
async function getRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req as any) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  if (!sig) {
    console.error('No stripe signature header');
    return res.status(400).send('No signature');
  }

  let event: Stripe.Event;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      webhookSecret
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the events
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Checkout completed:', session.id);

        // Get metadata from session
        const companyId = session.metadata?.company_id;
        const billingPeriod = session.metadata?.billing_period;
        const seatCount = session.metadata?.seat_count;
        const adminSeats = session.metadata?.admin_seats;
        const juniorSeats = session.metadata?.junior_seats;
        const pricePerMonth = session.metadata?.price_per_month;

        if (!companyId) {
          console.error('No company ID in session metadata');
          break;
        }

        // Update company with subscription AND seat allocation
        const { error: updateError } = await supabase
          .from('companies')
          .update({
            subscription_active: true,
            subscription_status: 'active',
            subscription_type: billingPeriod || 'monthly',
            subscription_seats: parseInt(seatCount || '0'),
            admin_seats: parseInt(adminSeats || '0'),
            junior_seats: parseInt(juniorSeats || '0'),
            subscription_price: parseFloat(pricePerMonth || '0'),
            stripe_subscription_id: (session.subscription as string) || session.id,
            subscription_started_at: new Date().toISOString(),
            trial_ends_at: new Date().toISOString(), // End trial immediately
            account_locked: false, // Unlock account if it was locked
            locked_at: null, // Clear lock timestamp
            updated_at: new Date().toISOString()
          })
          .eq('id', companyId);

        if (updateError) {
          console.error('Failed to update company:', updateError);
        } else {
          console.log(`Company ${companyId} subscription activated with ${seatCount} seats (${adminSeats} admin, ${juniorSeats} junior)`);
          
          // Send subscription activated email
          try {
            const response = await fetch(
              'https://wvzqxwvlozzbmdrqyify.supabase.co/functions/v1/subscription-activated',
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  companyId,
                  subscriptionType: billingPeriod,
                  seatCount: parseInt(seatCount || '0'),
                  adminSeats: parseInt(adminSeats || '0'),
                  juniorSeats: parseInt(juniorSeats || '0'),
                  monthlyPrice: parseFloat(pricePerMonth || '0')
                })
              }
            );
            
            if (!response.ok) {
              console.error('Failed to send subscription activated email:', await response.text());
            } else {
              console.log('Subscription activated email sent successfully');
            }
          } catch (emailError) {
            console.error('Error calling subscription-activated function:', emailError);
            // Don't throw - email failure shouldn't break the webhook
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Subscription updated:', subscription.id);
        
        // Find company by stripe_subscription_id
        const { data: company } = await supabase
          .from('companies')
          .select('id')
          .eq('stripe_subscription_id', subscription.id)
          .single();

        if (company) {
          await supabase
            .from('companies')
            .update({
              subscription_status: subscription.status,
              updated_at: new Date().toISOString()
            })
            .eq('id', company.id);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Subscription cancelled:', subscription.id);
        
        const { data: company } = await supabase
          .from('companies')
          .select('id')
          .eq('stripe_subscription_id', subscription.id)
          .single();

        if (company) {
          const now = new Date().toISOString();
          
          await supabase
            .from('companies')
            .update({
              subscription_active: false,        // Turn off access
              subscription_status: 'cancelled',  // Final status
              account_locked: true,              // Lock the account
              locked_at: now,                    // When it was locked
              cancel_at_period_end: false,      // Reset this flag
              updated_at: now
            })
            .eq('id', company.id);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Payment succeeded for invoice:', invoice.id);
        
        if ((invoice as any).subscription) {
          const { data: company } = await supabase
            .from('companies')
            .select('id')
            .eq('stripe_subscription_id', (invoice as any).subscription)
            .single();

          if (company) {
            await supabase
              .from('companies')
              .update({
                subscription_status: 'active',
                account_locked: false, // Ensure account is unlocked on successful payment
                locked_at: null,
                updated_at: new Date().toISOString()
              })
              .eq('id', company.id);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Payment failed for invoice:', invoice.id);
        
        if ((invoice as any).subscription) {
          const { data: company } = await supabase
            .from('companies')
            .select('id')
            .eq('stripe_subscription_id', (invoice as any).subscription)
            .single();

          if (company) {
            await supabase
              .from('companies')
              .update({
                subscription_status: 'past_due',
                updated_at: new Date().toISOString()
              })
              .eq('id', company.id);
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}