import { Hono } from 'hono';
import { initDatabase } from '../lib/db';

export const webhookRoutes = new Hono();

let dbInitialized = false;

async function ensureDb(c: any) {
  if (!dbInitialized) {
    await initDatabase(c.env.DB);
    dbInitialized = true;
  }
}

// Stripe webhook
webhookRoutes.post('/stripe/webhook', async (c) => {
  const body = await c.req.text();
  const signature = c.req.header('stripe-signature');
  
  // TODO: Verify Stripe signature
  // const event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
  
  try {
    const event = JSON.parse(body);
    
    switch (event.type) {
      case 'checkout.session.completed':
        console.log('Payment successful:', event.data?.object?.id);
        break;
      case 'charge.refunded':
        console.log('Refund processed:', event.data?.object?.id);
        break;
      default:
        console.log('Unhandled event:', event.type);
    }
  } catch (e) {
    console.error('Webhook error:', e);
  }
  
  return c.json({ received: true });
});

webhookRoutes.get('/webhook/health', async (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() });
});
