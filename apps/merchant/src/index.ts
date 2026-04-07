import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';

import { initRoutes } from './routes/init';
import { catalogRoutes } from './routes/catalog';
import { cartRoutes } from './routes/cart';
import { checkoutRoutes } from './routes/checkout';
import { adminRoutes } from './routes/admin';
import { webhookRoutes } from './routes/webhook';
import { kvCacheMiddleware } from './middleware/kv-cache';
import type { Env } from './types';

const app = new OpenAPIHono<{ Bindings: Env }>();

app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

app.use('*', kvCacheMiddleware);

app.get('/', (c) => c.json({
  name: 'Fufuni Merchant API',
  version: '1.0.0',
  documentation: '/ui',
  endpoints: {
    products: '/v1/products',
    categories: '/v1/categories',
    cart: '/v1/cart',
    checkout: '/v1/checkout',
    admin: '/v1/admin'
  }
}));

app.get('/ui', swaggerUI({ url: '/doc' }));
app.get('/doc', async (c) => {
  return c.json(app.openAPIRegistry.generateJSON());
});

app.route('/v1', initRoutes);
app.route('/v1', catalogRoutes);
app.route('/v1', cartRoutes);
app.route('/v1', checkoutRoutes);
app.route('/v1', adminRoutes);
app.route('/v1', webhookRoutes);

app.notFound((c) => c.json({ error: 'Not Found' }, 404));
app.onError((c, err) => {
  console.error('Error:', err);
  return c.json({ error: err.message || 'Internal Server Error' }, 500);
});

export default app;
