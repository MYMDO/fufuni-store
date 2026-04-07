import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../types';
import { generateId, initDatabase } from '../lib/db';

export const cartRoutes = new Hono<{ Bindings: Env }>();

let dbInitialized = false;

async function ensureDb(c: any) {
  if (!dbInitialized) {
    await initDatabase(c.env.DB);
    dbInitialized = true;
  }
}

// Get cart
cartRoutes.get('/cart/:id', async (c) => {
  await ensureDb(c);
  
  const id = c.req.param('id');
  
  const result = await c.env.DB
    .prepare('SELECT * FROM carts WHERE id = ?')
    .bind(id)
    .first();
  
  if (!result) {
    return c.json({ error: 'Cart not found' }, 404);
  }
  
  return c.json({
    id: result.id,
    items: JSON.parse(result.items || '[]'),
    subtotal: result.subtotal,
    currency: result.currency,
    createdAt: result.created_at,
    updatedAt: result.updated_at
  });
});

// Create cart
cartRoutes.post('/cart', async (c) => {
  await ensureDb(c);
  
  const id = generateId();
  const now = Date.now();
  
  await c.env.DB
    .prepare(`INSERT INTO carts (id, items, subtotal, currency, created_at, updated_at) VALUES (?, '[]', 0, 'UAH', ?, ?)`)
    .bind(id, now, now)
    .run();
  
  return c.json({
    id,
    items: [],
    subtotal: 0,
    currency: 'UAH',
    createdAt: now,
    updatedAt: now
  }, 201);
});

// Add item to cart
const addToCartSchema = z.object({
  productId: z.string(),
  variantId: z.string(),
  quantity: z.number().int().positive()
});

cartRoutes.post('/cart/:id/items', zValidator('json', addToCartSchema), async (c) => {
  await ensureDb(c);
  
  const cartId = c.req.param('id');
  const { productId, variantId, quantity } = c.req.valid('json');
  
  // Get or create cart
  let cart = await c.env.DB
    .prepare('SELECT * FROM carts WHERE id = ?')
    .bind(cartId)
    .first();
  
  if (!cart) {
    const newId = generateId();
    const now = Date.now();
    await c.env.DB
      .prepare(`INSERT INTO carts (id, items, subtotal, currency, created_at, updated_at) VALUES (?, '[]', 0, 'UAH', ?, ?)`)
      .bind(newId, now, now)
      .run();
    cart = { id: newId, items: '[]', subtotal: 0 };
  }
  
  // Get product and variant
  const product = await c.env.DB
    .prepare('SELECT * FROM products WHERE id = ?')
    .bind(productId)
    .first();
  
  if (!product) {
    return c.json({ error: 'Product not found' }, 404);
  }
  
  const variant = await c.env.DB
    .prepare('SELECT * FROM variants WHERE id = ? AND product_id = ?')
    .bind(variantId, productId)
    .first();
  
  if (!variant) {
    return c.json({ error: 'Variant not found' }, 404);
  }
  
  // Add to cart
  let items = JSON.parse(cart.items as string || '[]');
  const existingIndex = items.findIndex((i: any) => i.variantId === variantId);
  
  if (existingIndex >= 0) {
    items[existingIndex].quantity += quantity;
  } else {
    items.push({
      id: generateId(),
      productId,
      variantId,
      quantity,
      price: variant.price,
      title: product.title,
      sku: variant.sku,
      image: JSON.parse(product.images as string || '[]')[0]
    });
  }
  
  const subtotal = items.reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0);
  const now = Date.now();
  
  await c.env.DB
    .prepare('UPDATE carts SET items = ?, subtotal = ?, updated_at = ? WHERE id = ?')
    .bind(JSON.stringify(items), subtotal, now, cartId)
    .run();
  
  return c.json({
    id: cartId,
    items,
    subtotal,
    currency: 'UAH',
    updatedAt: now
  });
});

// Update cart item quantity
const updateCartItemSchema = z.object({
  quantity: z.number().int().min(0)
});

cartRoutes.patch('/cart/:cartId/items/:itemId', zValidator('json', updateCartItemSchema), async (c) => {
  await ensureDb(c);
  
  const { cartId, itemId } = c.req.param();
  const { quantity } = c.req.valid('json');
  
  const cart = await c.env.DB
    .prepare('SELECT * FROM carts WHERE id = ?')
    .bind(cartId)
    .first();
  
  if (!cart) {
    return c.json({ error: 'Cart not found' }, 404);
  }
  
  let items = JSON.parse(cart.items as string || '[]');
  const index = items.findIndex((i: any) => i.id === itemId);
  
  if (index < 0) {
    return c.json({ error: 'Item not found' }, 404);
  }
  
  if (quantity <= 0) {
    items.splice(index, 1);
  } else {
    items[index].quantity = quantity;
  }
  
  const subtotal = items.reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0);
  const now = Date.now();
  
  await c.env.DB
    .prepare('UPDATE carts SET items = ?, subtotal = ?, updated_at = ? WHERE id = ?')
    .bind(JSON.stringify(items), subtotal, now, cartId)
    .run();
  
  return c.json({
    id: cartId,
    items,
    subtotal,
    currency: 'UAH'
  });
});

// Remove item from cart
cartRoutes.delete('/cart/:cartId/items/:itemId', async (c) => {
  const { cartId, itemId } = c.req.param();
  
  const cart = await c.env.DB
    .prepare('SELECT * FROM carts WHERE id = ?')
    .bind(cartId)
    .first();
  
  if (!cart) {
    return c.json({ error: 'Cart not found' }, 404);
  }
  
  let items = JSON.parse(cart.items as string || '[]').filter((i: any) => i.id !== itemId);
  const subtotal = items.reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0);
  const now = Date.now();
  
  await c.env.DB
    .prepare('UPDATE carts SET items = ?, subtotal = ?, updated_at = ? WHERE id = ?')
    .bind(JSON.stringify(items), subtotal, now, cartId)
    .run();
  
  return c.json({
    id: cartId,
    items,
    subtotal,
    currency: 'UAH'
  });
});

// Clear cart
cartRoutes.delete('/cart/:id', async (c) => {
  await ensureDb(c);
  
  const id = c.req.param('id');
  const now = Date.now();
  
  await c.env.DB
    .prepare('UPDATE carts SET items = ?, subtotal = ?, updated_at = ? WHERE id = ?')
    .bind('[]', 0, now, id)
    .run();
  
  return c.json({ id, items: [], subtotal: 0, currency: 'UAH' });
});
