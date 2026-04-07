import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../types';
import { generateId, generateOrderNumber, initDatabase } from '../lib/db';

export const checkoutRoutes = new Hono<{ Bindings: Env }>();

let dbInitialized = false;

async function ensureDb(c: any) {
  if (!dbInitialized) {
    await initDatabase(c.env.DB);
    dbInitialized = true;
  }
}

const checkoutSchema = z.object({
  cartId: z.string(),
  customer: z.object({
    email: z.string().email(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional()
  }),
  shippingAddress: z.object({
    line1: z.string(),
    city: z.string(),
    postalCode: z.string()
  }).optional()
});

checkoutRoutes.post('/checkout', zValidator('json', checkoutSchema), async (c) => {
  await ensureDb(c);
  
  const data = c.req.valid('json');
  
  // Get cart
  const cart = await c.env.DB
    .prepare('SELECT * FROM carts WHERE id = ?')
    .bind(data.cartId)
    .first();
  
  if (!cart) {
    return c.json({ error: 'Cart not found' }, 404);
  }
  
  const items = JSON.parse(cart.items as string || '[]');
  
  if (items.length === 0) {
    return c.json({ error: 'Cart is empty' }, 400);
  }
  
  // Create order
  const id = generateId();
  const number = generateOrderNumber();
  const now = Date.now();
  const subtotal = cart.subtotal as number;
  const shipping = 0;
  const tax = 0;
  const total = subtotal + shipping + tax;
  
  await c.env.DB
    .prepare(`INSERT INTO orders (id, number, status, items, subtotal, shipping, tax, total, currency, customer, created_at, updated_at) VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, 'UAH', ?, ?, ?)`)
    .bind(id, number, JSON.stringify(items), subtotal, shipping, tax, total, JSON.stringify(data.customer), now, now)
    .run();
  
  // Clear cart
  await c.env.DB
    .prepare('UPDATE carts SET items = ?, subtotal = ?, updated_at = ? WHERE id = ?')
    .bind('[]', 0, now, data.cartId)
    .run();
  
  return c.json({
    order: {
      id,
      number,
      status: 'pending',
      items,
      subtotal,
      shipping,
      tax,
      total,
      currency: 'UAH',
      customer: data.customer
    },
    message: 'Order created successfully'
  }, 201);
});

// Get order
checkoutRoutes.get('/orders/:id', async (c) => {
  await ensureDb(c);
  
  const id = c.req.param('id');
  
  const result = await c.env.DB
    .prepare('SELECT * FROM orders WHERE id = ?')
    .bind(id)
    .first();
  
  if (!result) {
    return c.json({ error: 'Order not found' }, 404);
  }
  
  return c.json({
    id: result.id,
    number: result.number,
    status: result.status,
    items: JSON.parse(result.items || '[]'),
    subtotal: result.subtotal,
    shipping: result.shipping,
    tax: result.tax,
    total: result.total,
    currency: result.currency,
    customer: JSON.parse(result.customer || '{}'),
    createdAt: result.created_at
  });
});

// Get shipping rates
checkoutRoutes.get('/checkout/shipping-rates', async (c) => {
  return c.json({
    rates: [
      { id: 'standard', name: 'Стандартна доставка', price: 0, estimatedDays: 5 },
      { id: 'express', name: 'Експрес доставка', price: 5000, estimatedDays: 2 }
    ],
    freeThreshold: 50000
  });
});
