import { Hono } from 'hono';
import type { Env } from '../types';
import { initDatabase } from '../lib/db';

export const adminRoutes = new Hono<{ Bindings: Env }>();

let dbInitialized = false;

async function ensureDb(c: any) {
  if (!dbInitialized) {
    await initDatabase(c.env.DB);
    dbInitialized = true;
  }
}

// Dashboard stats
adminRoutes.get('/admin/stats', async (c) => {
  await ensureDb(c);
  
  const orders = await c.env.DB.prepare('SELECT * FROM orders').all();
  const products = await c.env.DB.prepare('SELECT * FROM products').all();
  
  const totalRevenue = (orders.results || []).reduce((sum: number, o: any) => {
    return sum + (o.status === 'paid' || o.status === 'pending' ? o.total : 0);
  }, 0);
  
  const customers = new Set((orders.results || []).map((o: any) => {
    const customer = JSON.parse(o.customer || '{}');
    return customer.email;
  }));
  
  return c.json({
    stats: {
      totalRevenue,
      totalOrders: (orders.results || []).length,
      totalProducts: (products.results || []).length,
      totalCustomers: customers.size,
      averageOrderValue: orders.results?.length ? Math.round(totalRevenue / orders.results.length) : 0
    }
  });
});

// All orders
adminRoutes.get('/admin/orders', async (c) => {
  await ensureDb(c);
  
  const status = c.req.query('status');
  let query = 'SELECT * FROM orders';
  const bindings: any[] = [];
  
  if (status) {
    query += ' WHERE status = ?';
    bindings.push(status);
  }
  
  query += ' ORDER BY created_at DESC LIMIT 50';
  
  const result = await c.env.DB.prepare(query).bind(...bindings).all();
  
  const orders = (result.results || []).map((row: any) => ({
    id: row.id,
    number: row.number,
    status: row.status,
    items: JSON.parse(row.items || '[]'),
    subtotal: row.subtotal,
    shipping: row.shipping,
    tax: row.tax,
    total: row.total,
    currency: row.currency,
    customer: JSON.parse(row.customer || '{}'),
    createdAt: row.created_at
  }));
  
  return c.json({ orders });
});

// Update order status
adminRoutes.patch('/admin/orders/:id', async (c) => {
  await ensureDb(c);
  
  const id = c.req.param('id');
  const { status } = await c.req.json();
  const now = Date.now();
  
  await c.env.DB
    .prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?')
    .bind(status, now, id)
    .run();
  
  const result = await c.env.DB
    .prepare('SELECT * FROM orders WHERE id = ?')
    .bind(id)
    .first();
  
  return c.json({
    id: result.id,
    number: result.number,
    status: result.status,
    total: result.total
  });
});

// Get config
adminRoutes.get('/admin/config', async (c) => {
  return c.json({
    storeName: c.env.STORE_NAME || 'Fufuni Store',
    currency: 'UAH'
  });
});
