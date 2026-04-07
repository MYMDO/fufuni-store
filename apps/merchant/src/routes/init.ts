import { Hono } from 'hono';
import { initDatabase } from '../lib/db';

export const initRoutes = new Hono();

let dbInitialized = false;

async function ensureDb(c: any) {
  if (!dbInitialized) {
    await initDatabase(c.env.DB);
    dbInitialized = true;
  }
}

initRoutes.get('/setup/status', async (c) => {
  await ensureDb(c);
  
  const count = await c.env.DB.prepare('SELECT COUNT(*) as count FROM products').first();
  
  return c.json({
    configured: true,
    storeName: c.env.STORE_NAME || 'Fufuni Store',
    currency: 'UAH',
    productCount: count?.count || 0
  });
});

initRoutes.post('/setup/init', async (c) => {
  await ensureDb(c);
  return c.json({ success: true, message: 'Database initialized' });
});
