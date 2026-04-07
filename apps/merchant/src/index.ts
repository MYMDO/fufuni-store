import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Env } from './types';
import { generateId, generateSku, initDatabase } from './lib/db';

const app = new Hono<{ Bindings: Env }>();

app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.get('/', (c) => c.json({
  name: 'Fufuni Merchant API',
  version: '1.0.0',
  store: c.env.STORE_NAME || 'Fufuni Store',
  endpoints: {
    products: '/v1/products',
    categories: '/v1/categories',
    cart: '/v1/cart',
    checkout: '/v1/checkout',
    admin: '/v1/admin'
  }
}));

// Products
app.get('/v1/products', async (c) => {
  try {
    const result = await c.env.DB
      .prepare('SELECT * FROM products WHERE status = ? ORDER BY created_at DESC LIMIT 50')
      .bind('active')
      .all();
    
    const products = (result.results || []).map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      price: row.price,
      currency: row.currency,
      status: row.status
    }));
    
    return c.json({ products, total: products.length });
  } catch (e: any) {
    console.error('Products error:', e);
    return c.json({ error: e.message }, 500);
  }
});

app.post('/v1/products', async (c) => {
  try {
    const body = await c.req.json();
    const { title, description, price } = body;
    
    if (!title || !price) {
      return c.json({ error: 'title and price required' }, 400);
    }
    
    const id = generateId();
    const sku = generateSku(id);
    const now = Date.now();
    
    await c.env.DB
      .prepare(`INSERT INTO products (id, title, description, price, currency, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'UAH', 'active', ?, ?)`)
      .bind(id, title, description || '', price, now, now)
      .run();
    
    return c.json({ id, title, price, sku, status: 'active' }, 201);
  } catch (e: any) {
    console.error('Create product error:', e);
    return c.json({ error: e.message }, 500);
  }
});

// Cart
app.post('/v1/cart', async (c) => {
  try {
    const id = generateId();
    const now = Date.now();
    
    await c.env.DB
      .prepare(`INSERT INTO carts (id, items, subtotal, currency, created_at, updated_at) VALUES (?, '[]', 0, 'UAH', ?, ?)`)
      .bind(id, now, now)
      .run();
    
    return c.json({ id, items: [], subtotal: 0, currency: 'UAH' }, 201);
  } catch (e: any) {
    console.error('Create cart error:', e);
    return c.json({ error: e.message }, 500);
  }
});

app.get('/v1/cart/:id', async (c) => {
  try {
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
      items: JSON.parse(result.items as string || '[]'),
      subtotal: result.subtotal,
      currency: result.currency
    });
  } catch (e: any) {
    console.error('Get cart error:', e);
    return c.json({ error: e.message }, 500);
  }
});

app.post('/v1/cart/:id/items', async (c) => {
  try {
    const cartId = c.req.param('id');
    const { productId, variantId, quantity } = await c.req.json();
    
    // Get product
    const product = await c.env.DB
      .prepare('SELECT * FROM products WHERE id = ?')
      .bind(productId)
      .first();
    
    if (!product) {
      return c.json({ error: 'Product not found' }, 404);
    }
    
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
    
    // Add item
    let items = JSON.parse(cart.items as string || '[]');
    const existingIndex = items.findIndex((i: any) => i.productId === productId);
    
    if (existingIndex >= 0) {
      items[existingIndex].quantity += quantity;
    } else {
      items.push({
        id: generateId(),
        productId,
        variantId,
        quantity,
        price: product.price,
        title: product.title
      });
    }
    
    const subtotal = items.reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0);
    const now = Date.now();
    
    await c.env.DB
      .prepare('UPDATE carts SET items = ?, subtotal = ?, updated_at = ? WHERE id = ?')
      .bind(JSON.stringify(items), subtotal, now, cartId)
      .run();
    
    return c.json({ id: cartId, items, subtotal });
  } catch (e: any) {
    console.error('Add to cart error:', e);
    return c.json({ error: e.message }, 500);
  }
});

// Checkout
app.post('/v1/checkout', async (c) => {
  try {
    const { cartId, customer } = await c.req.json();
    
    const cart = await c.env.DB
      .prepare('SELECT * FROM carts WHERE id = ?')
      .bind(cartId)
      .first();
    
    if (!cart) {
      return c.json({ error: 'Cart not found' }, 404);
    }
    
    const items = JSON.parse(cart.items as string || '[]');
    if (items.length === 0) {
      return c.json({ error: 'Cart is empty' }, 400);
    }
    
    const id = generateId();
    const number = `ORD-${Date.now().toString(36).toUpperCase()}`;
    const subtotal = cart.subtotal as number;
    const now = Date.now();
    
    await c.env.DB
      .prepare(`INSERT INTO orders (id, number, status, items, subtotal, shipping, tax, total, currency, customer, created_at, updated_at) VALUES (?, ?, 'pending', ?, ?, 0, 0, ?, 'UAH', ?, ?, ?)`)
      .bind(id, number, JSON.stringify(items), subtotal, subtotal, JSON.stringify(customer), now, now)
      .run();
    
    // Clear cart
    await c.env.DB
      .prepare('UPDATE carts SET items = ?, subtotal = ?, updated_at = ? WHERE id = ?')
      .bind('[]', 0, now, cartId)
      .run();
    
    return c.json({ orderId: id, number, status: 'pending', total: subtotal }, 201);
  } catch (e: any) {
    console.error('Checkout error:', e);
    return c.json({ error: e.message }, 500);
  }
});

// Orders
app.get('/v1/orders/:id', async (c) => {
  try {
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
      items: JSON.parse(result.items as string || '[]'),
      total: result.total,
      customer: JSON.parse(result.customer as string || '{}'),
      createdAt: result.created_at
    });
  } catch (e: any) {
    console.error('Get order error:', e);
    return c.json({ error: e.message }, 500);
  }
});

// Admin
app.get('/v1/admin/stats', async (c) => {
  try {
    const orders = await c.env.DB.prepare('SELECT COUNT(*) as count, SUM(total) as revenue FROM orders').first();
    const products = await c.env.DB.prepare('SELECT COUNT(*) as count FROM products').first();
    
    return c.json({
      totalOrders: orders?.count || 0,
      totalRevenue: orders?.revenue || 0,
      totalProducts: products?.count || 0
    });
  } catch (e: any) {
    console.error('Stats error:', e);
    return c.json({ error: e.message }, 500);
  }
});

// Health
app.get('/health', (c) => c.json({ status: 'ok' }));

app.notFound((c) => c.json({ error: 'Not Found' }, 404));
app.onError((c, err) => {
  console.error('Error:', err);
  return c.json({ error: err.message || 'Internal Server Error' }, 500);
});

export default app;
