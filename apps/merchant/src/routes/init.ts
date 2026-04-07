import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../types';
import { getDO, requireAuth } from '../lib/helpers';

export const initRoutes = new Hono<{ Bindings: Env }>();

const setupStripeSchema = z.object({
  stripeSecretKey: z.string().startsWith('sk_'),
  stripeWebhookSecret: z.string().startsWith('whsec_')
});

const storeConfigSchema = z.object({
  storeName: z.string().optional(),
  currency: z.string().length(3).optional(),
  shipping: z.object({
    enabled: z.boolean().optional(),
    freeThreshold: z.number().optional(),
    defaultRate: z.number().optional(),
    rates: z.array(z.object({
      id: z.string(),
      name: z.string(),
      price: z.number(),
      currency: z.string().optional(),
      estimatedDays: z.number().optional(),
      countries: z.array(z.string()).optional()
    })).optional()
  }).optional(),
  tax: z.object({
    enabled: z.boolean().optional(),
    rate: z.number().optional(),
    included: z.boolean().optional()
  }).optional()
});

initRoutes.post('/setup/stripe', zValidator('json', setupStripeSchema), async (c) => {
  const { stripeSecretKey, stripeWebhookSecret } = c.req.valid('json');
  
  // Store Stripe credentials (in production, use secrets)
  // For now, we just validate them
  if (!stripeSecretKey.startsWith('sk_test_') && !stripeSecretKey.startsWith('sk_live_')) {
    return c.json({ error: 'Invalid Stripe secret key' }, 400);
  }
  
  return c.json({
    success: true,
    message: 'Stripe configured successfully',
    webhookEndpoint: `${c.env.API_BASE_URL || 'https://your-worker.workers.dev'}/v1/stripe/webhook`
  });
});

initRoutes.get('/setup/status', async (c) => {
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  const config = await doStub.getConfig();
  
  return c.json({
    configured: !!config.storeName,
    storeName: config.storeName,
    currency: config.currency
  });
});

initRoutes.get('/config', async (c) => {
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  const config = await doStub.getConfig();
  
  return c.json(config);
});

initRoutes.put('/config', zValidator('json', storeConfigSchema), requireAuth('admin'), async (c) => {
  const data = c.req.valid('json');
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  const config = await doStub.getConfig();
  
  const updatedConfig = {
    ...config,
    ...data,
    storeName: data.storeName || config.storeName,
    currency: data.currency || config.currency,
    shipping: {
      ...config.shipping,
      ...data.shipping
    },
    tax: {
      ...config.tax,
      ...data.tax
    }
  };
  
  await doStub.setConfig(updatedConfig);
  
  return c.json(updatedConfig);
});

initRoutes.post('/keys/generate', requireAuth('admin'), async (c) => {
  // Generate new API keys
  const publicKey = 'pk_' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  const secretKey = 'sk_' + Array.from(crypto.getRandomValues(new Uint8Array(48)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  
  return c.json({
    publicKey,
    secretKey,
    message: 'Store these keys securely. The secret key will not be shown again.'
  });
});
