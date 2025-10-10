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
        
        // Check if this is a seat update payment
        const isSeatUpdate = session.metadata?.seat_update === 'true';
        const newSeatCount = session.metadata?.new_seat_count;
        const subscriptionId = session.metadata?.subscription_id;

        if (!companyId) {
          console.error('No company ID in session metadata');
          break;
        }

        // HANDLE SEAT UPDATE PAYMENT
        if (isSeatUpdate && subscriptionId && newSeatCount) {
          console.log('Processing seat update payment for subscription:', subscriptionId);
          
          try {
            // Get the pending seat allocation from database
            const { data: company } = await supabase
              .from('companies')
              .select('pending_admin_seats, pending_junior_seats, subscription_type')
              .eq('id', companyId)
              .single();

            if (!company) {
              console.error('Company not found');
              break;
            }

            // Update the subscription quantity in Stripe (no proration since payment already taken)
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            
            // Determine pricing tier for new seat count
            const newSeatCountNum = parseInt(newSeatCount);
            let pricePerSeat = 30;
            if (newSeatCountNum <= 14) pricePerSeat = 30;
            else if (newSeatCountNum <= 29) pricePerSeat = 27;
            else pricePerSeat = 24;

            // Determine product ID based on subscription type
            let productId = '';
            if (company.subscription_type === 'annual') {
              productId = newSeatCountNum <= 14 ? 'prod_TCLns1si1ulZ4p' : 
                         newSeatCountNum <= 29 ? 'prod_TCLoT9ndmjiSkW' : 
                         'prod_TCLqYrus5QQlKi';
            } else {
              productId = newSeatCountNum <= 14 ? 'prod_T8XJnL61gY927i' : 
                         newSeatCountNum <= 29 ? 'prod_T8XMTp9qKMSyVh' : 
                         'prod_T8XNn9mRSDskk7';
            }

            // Calculate price with VAT
            let priceWithVatPence;
            let recurringInterval;
            
            if (company.subscription_type === 'annual') {
              const annualPricePerSeat = pricePerSeat * 12 * 0.9; // 10% discount
              const vatAmount = Math.round(annualPricePerSeat * 100 * 0.2);
              priceWithVatPence = Math.round(annualPricePerSeat * 100) + vatAmount;
              recurringInterval = { interval: 'year' as const };
            } else {
              const pricePerSeatPence = pricePerSeat * 100;
              const vatAmount = Math.round(pricePerSeatPence * 0.2);
              priceWithVatPence = pricePerSeatPence + vatAmount;
              recurringInterval = { interval: 'month' as const };
            }

            // Create new price
            const newPrice = await stripe.prices.create({
              currency: 'gbp',
              unit_amount: priceWithVatPence,
              recurring: recurringInterval,
              product: productId,
            });

            // Update subscription with new quantity (no proration since already paid)
            await stripe.subscriptions.update(subscriptionId, {
              items: [{
                id: subscription.items.data[0].id,
                price: newPrice.id,
                quantity: newSeatCountNum
              }],
              proration_behavior: 'none', // Don't charge again
              metadata: {
                seat_count: newSeatCount,
                last_seat_update: new Date().toISOString()
              }
            });

            // Calculate new monthly price
            const newMonthlyPrice = newSeatCountNum * pricePerSeat;

            // Get seat allocation from session metadata (passed from create-seat-update-payment)
            const sessionAdminSeats = parseInt(session.metadata?.admin_seats || '0');
            const sessionJuniorSeats = parseInt(session.metadata?.junior_seats || '0');

            // Update database with new seats
            await supabase
              .from('companies')
              .update({
               subscription_seats: newSeatCountNum,
               admin_seats: sessionAdminSeats,
               junior_seats: sessionJuniorSeats,
               subscription_price: newMonthlyPrice,
               price_per_month: newMonthlyPrice,
               discount_percentage: newSeatCountNum >= 30 ? 20 : newSeatCountNum >= 15 ? 10 : 0,
               updated_at: new Date().toISOString()
            })
             .eq('id', companyId);

            console.log(`Seat update completed: ${newSeatCount} seats activated`);
          } catch (error) {
            console.error('Error processing seat update:', error);
          }
          break; // Exit early for seat updates
        }

        // HANDLE NEW SUBSCRIPTION CHECKOUT (existing logic)
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
            price_per_month: actualPricePerMonth,
            discount_percentage: discountPercentage,
            stripe_subscription_id: (session.subscription as string) || session.id,
            subscription_started_at: new Date().toISOString(),
            trial_ends_at: new Date().toISOString(), // End trial immediately
            account_locked: false,
            locked_at: null,
            cancel_at_period_end: false, // Clear any pending cancellation
            scheduled_cancellation_date: null,
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

          // Check if subscription is set to cancel at period end
          if (subscription.cancel_at_period_end) {
            updateData.cancel_at_period_end = true;
            updateData.scheduled_cancellation_date = subscription.cancel_at 
              ? new Date(subscription.cancel_at * 1000).toISOString() 
              : null;
          } else {
            updateData.cancel_at_period_end = false;
            updateData.scheduled_cancellation_date = null;
          }

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
          .select('id, scheduled_cancellation_date')
          .eq('stripe_subscription_id', subscription.id)
          .single();

        if (company) {
          const now = new Date();
          const scheduledDate = company.scheduled_cancellation_date 
            ? new Date(company.scheduled_cancellation_date) 
            : now;
          
          // Only lock if we've passed the scheduled cancellation date
          const shouldLock = scheduledDate <= now;
          
          await supabase
            .from('companies')
            .update({
              subscription_active: false,
              subscription_status: 'cancelled',
              account_locked: shouldLock,
              locked_at: shouldLock ? now.toISOString() : null,
              cancel_at_period_end: false,
              updated_at: now.toISOString()
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
                account_locked: false,
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