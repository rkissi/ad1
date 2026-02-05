import { Router } from 'express';
import Stripe from 'stripe';

// Use a dummy key if missing to prevent startup crash, but warn.
const stripeKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_key_to_prevent_crash';
if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('⚠️ STRIPE_SECRET_KEY is missing. Payment features will fail.');
}

const stripe = new Stripe(stripeKey, {
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
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });

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
      metadata,
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

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        console.log('✅ Payment succeeded:', event.data.object.id);
        break;
      case 'payment_intent.payment_failed':
        console.log('❌ Payment failed:', event.data.object.id);
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
