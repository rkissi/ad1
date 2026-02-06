import { Router } from 'express';
import Stripe from 'stripe';
import { supabaseServer } from '../lib/supabase-server';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('FATAL: STRIPE_SECRET_KEY is missing. Payment system cannot start.');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia'
});

export const paymentRouter = Router();

// Create payment intent
paymentRouter.post('/create-intent', async (req, res) => {
  try {
    const { amount, currency = 'usd', metadata } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      metadata: {
        ...metadata,
        userId: req.user?.id // Link to Supabase user
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Create pending transaction record in Supabase
    if (req.user?.id) {
        const { error } = await supabaseServer.from('transactions').insert({
            amount: amount, // Storing in base currency (e.g. USD), not cents
            currency,
            status: 'pending',
            stripe_payment_id: paymentIntent.id,
            from_user_id: req.user.id,
            type: 'deposit',
            metadata: { ...metadata, payment_intent_id: paymentIntent.id }
        });

        if (error) {
            console.error('Failed to create pending transaction record:', error);
            // We don't block the response, as the client needs the secret to pay.
            // Webhook might reconcile or create if missing (upsert logic in webhook is safer but complex).
        }
    }

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error: any) {
    console.error('Payment intent creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get payment methods
paymentRouter.get('/methods/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;

    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    res.json(paymentMethods.data);
  } catch (error: any) {
    console.error('Payment methods fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create customer
paymentRouter.post('/customers', async (req, res) => {
  try {
    const { email, name, metadata } = req.body;

    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        ...metadata,
        userId: req.user?.id
      },
    });

    res.json(customer);
  } catch (error: any) {
    console.error('Customer creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get transactions
paymentRouter.get('/transactions/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;

    const charges = await stripe.charges.list({
      customer: customerId,
      limit: 100,
    });

    const transactions = charges.data.map(charge => ({
      id: charge.id,
      amount: charge.amount,
      currency: charge.currency,
      status: charge.status,
      description: charge.description || 'Payment',
      created: charge.created * 1000,
    }));

    res.json(transactions);
  } catch (error: any) {
    console.error('Transactions fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook handler
paymentRouter.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return res.status(400).send('Webhook secret not configured');
  }

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      webhookSecret
    );

    // Handle different event types with database sync
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('✅ Payment succeeded:', paymentIntent.id);

        await supabaseServer
            .from('transactions')
            .update({ status: 'completed' })
            .eq('stripe_payment_id', paymentIntent.id);

        // Trigger campaign activation or funding logic if applicable
        // This could be done by a trigger on 'transactions' table update
        break;

      case 'payment_intent.payment_failed':
        const paymentFailed = event.data.object as Stripe.PaymentIntent;
        console.log('❌ Payment failed:', paymentFailed.id);

        await supabaseServer
            .from('transactions')
            .update({ status: 'failed' })
            .eq('stripe_payment_id', paymentFailed.id);
        break;

      case 'customer.created':
        console.log('👤 Customer created:', event.data.object.id);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

export default paymentRouter;
