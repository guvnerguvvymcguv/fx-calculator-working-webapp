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
        const seatCountNum = parseInt(seatCount || '0');
        const discountPercentage = seatCountNum >= 30 ? 20 : seatCountNum >= 15 ? 10 : 0;

        if (!companyId) {
          console.error('No company ID in session metadata');
          break;
        }

        // If subscription exists, fetch it to get actual details including quantity
        let actualSeatCount = seatCountNum;
        let actualPricePerMonth = parseFloat(pricePerMonth || '0');
        
        if (session.subscription) {
          try {
            const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
            if (subscription.items && subscription.items.data.length > 0) {
              // Get the actual quantity from the subscription
              actualSeatCount = subscription.items.data[0].quantity || seatCountNum;
              
              // Calculate the actual monthly price based on quantity and price per unit
              const pricePerUnit = subscription.items.data[0].price.unit_amount || 0;
              // Remove VAT to get base price (price includes 20% VAT)
              const pricePerUnitExVat = pricePerUnit / 1.2;
              actualPricePerMonth = (pricePerUnitExVat * actualSeatCount) / 100; // Convert from pence to pounds
              
              console.log('Subscription details from Stripe:', {
                quantity: actualSeatCount,
                pricePerUnit: pricePerUnit,
                calculatedMonthlyPrice: actualPricePerMonth
              });
            }
          } catch (subError) {
            console.error('Error fetching subscription details:', subError);
            // Fall back to session metadata values
          }
        }

        // Update company with subscription AND seat allocation
        const { error: updateError } = await supabase
          .from('companies')
          .update({
            subscription_active: true,
            subscription_status: 'active',
            subscription_type: billingPeriod || 'monthly',
            subscription_seats: actualSeatCount,
            admin_seats: parseInt(adminSeats || '0'),
            junior_seats: parseInt(juniorSeats || '0'),
            subscription_price: actualPricePerMonth,
            price_per_month: actualPricePerMonth, // Also update this field
            discount_percentage: discountPercentage,
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
          console.log(`Company ${companyId} subscription activated with ${actualSeatCount} seats (${adminSeats} admin, ${juniorSeats} junior)`);
          
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
                  seatCount: actualSeatCount,
                  adminSeats: parseInt(adminSeats || '0'),
                  juniorSeats: parseInt(juniorSeats || '0'),
                  monthlyPrice: actualPricePerMonth
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
          // Get the actual quantity and price from the subscription
          let updateData: any = {
            subscription_status: subscription.status,
            updated_at: new Date().toISOString()
          };

          // If subscription has items, update seat count and price
          if (subscription.items && subscription.items.data.length > 0) {
            const item = subscription.items.data[0];
            const quantity = item.quantity || 0;
            const pricePerUnit = item.price.unit_amount || 0;
            // Remove VAT to get base price (price includes 20% VAT)
            const pricePerUnitExVat = pricePerUnit / 1.2;
            const monthlyPrice = (pricePerUnitExVat * quantity) / 100; // Convert from pence to pounds
            
            updateData.subscription_seats = quantity;
            updateData.subscription_price = monthlyPrice;
            updateData.price_per_month = monthlyPrice;
            
            // Update discount percentage based on new quantity
            updateData.discount_percentage = quantity >= 30 ? 20 : quantity >= 15 ? 10 : 0;
            
            console.log('Updating subscription with quantity:', quantity, 'price:', monthlyPrice);
          }

          await supabase
            .from('companies')
            .update(updateData)
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