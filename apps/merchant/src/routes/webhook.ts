import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../types';
import { getDO } from '../lib/helpers';

export const webhookRoutes = new Hono<{ Bindings: Env }>();

// Stripe webhook handler
const stripeWebhookSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    object: z.object({
      id: z.string(),
      customer_email: z.string().optional(),
      customer_details: z.object({
        email: z.string().optional()
      }).optional(),
      amount_total: z.number().optional(),
      payment_status: z.string().optional(),
      metadata: z.record(z.string()).optional()
    })
  })
});

webhookRoutes.post('/stripe/webhook', async (c) => {
  const body = await c.req.text();
  const signature = c.req.header('stripe-signature');
  
  // In production, verify Stripe signature
  // const event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
  
  let event;
  try {
    event = JSON.parse(body);
  } catch {
    return c.json({ error: 'Invalid payload' }, 400);
  }
  
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      
      // Update order status to paid
      if (session.metadata?.orderId) {
        await doStub.updateOrder(session.metadata.orderId, {
          status: 'paid',
          stripeSessionId: session.id
        });
      } else if (session.id) {
        await doStub.updateOrderByStripeSession(session.id, {
          status: 'paid'
        });
      }
      
      // In production: send confirmation email
      console.log('Order paid:', session.id);
      break;
      
    case 'checkout.session.expired':
      const expiredSession = event.data.object;
      
      if (expiredSession.metadata?.orderId) {
        await doStub.updateOrder(expiredSession.metadata.orderId, {
          status: 'cancelled'
        });
      }
      break;
      
    case 'charge.refunded':
      const charge = event.data.object;
      
      if (charge.payment_intent) {
        await doStub.updateOrderByStripeSession(charge.payment_intent, {
          status: 'refunded'
        });
      }
      break;
      
    default:
      console.log('Unhandled event type:', event.type);
  }
  
  return c.json({ received: true });
});

// Health check for webhooks
webhookRoutes.get('/webhook/health', async (c) => {
  return c.json({
    status: 'ok',
    timestamp: Date.now(),
    provider: 'fufuni'
  });
});
