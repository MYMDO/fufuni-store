import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../types';
import { generateId, generateSku, initDatabase } from '../lib/db';

export const catalogRoutes = new Hono<{ Bindings: Env }>();

// Initialize database on first request
let dbInitialized = false;

async function ensureDb(c: any) {
  if (!dbInitialized) {
    await initDatabase(c.env.DB);
    dbInitialized = true;
  }
}

// Get all products
catalogRoutes.get('/products', async (c) => {
  await ensureDb(c);
  
  const status = c.req.query('status') || 'active';
  const limit = parseInt(c.req.query('limit') || '50');
  
  const result = await c.env.DB
    .prepare('SELECT * FROM products WHERE status = ? ORDER BY created_at DESC LIMIT ?')
    .bind(status, limit)
    .all();
  
  const products = [];
  for (const row of result.results || []) {
    const variants = await c.env.DB
      .prepare('SELECT * FROM variants WHERE product_id = ?')
      .bind(row.id)
      .all();
    
    products.push({
      id: row.id,
      title: row.title,
      description: row.description,
      price: row.price,
      currency: row.currency,
      images: JSON.parse(row.images || '[]'),
      categoryId: row.category_id,
      status: row.status,
      variants: (variants.results || []).map((v: any) => ({
        id: v.id,
        sku: v.sku,
        title: v.title,
        price: v.price,
        compareAtPrice: v.compare_at_price,
        currency: v.currency,
        stock: v.stock,
        options: JSON.parse(v.options || '{}')
      })),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }
  
  return c.json({ products, total: products.length });
});

// Search products
catalogRoutes.get('/products/search', async (c) => {
  await ensureDb(c);
  
  const q = c.req.query('q')?.toLowerCase() || '';
  const limit = parseInt(c.req.query('limit') || '20');
  
  const result = await c.env.DB
    .prepare('SELECT * FROM products WHERE status = ? AND (title LIKE ? OR description LIKE ?) LIMIT ?')
    .bind('active', `%${q}%`, `%${q}%`, limit)
    .all();
  
  const products = (result.results || []).map((row: any) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    price: row.price,
    currency: row.currency,
    images: JSON.parse(row.images || '[]'),
    categoryId: row.category_id,
    status: row.status
  }));
  
  return c.json({ products, total: products.length });
});

// Get single product
catalogRoutes.get('/products/:id', async (c) => {
  await ensureDb(c);
  
  const id = c.req.param('id');
  
  const result = await c.env.DB
    .prepare('SELECT * FROM products WHERE id = ?')
    .bind(id)
    .first();
  
  if (!result) {
    return c.json({ error: 'Product not found' }, 404);
  }
  
  const variants = await c.env.DB
    .prepare('SELECT * FROM variants WHERE product_id = ?')
    .bind(id)
    .all();
  
  return c.json({
    id: result.id,
    title: result.title,
    description: result.description,
    price: result.price,
    currency: result.currency,
    images: JSON.parse(result.images || '[]'),
    categoryId: result.category_id,
    status: result.status,
    variants: (variants.results || []).map((v: any) => ({
      id: v.id,
      sku: v.sku,
      title: v.title,
      price: v.price,
      stock: v.stock
    })),
    createdAt: result.created_at,
    updatedAt: result.updated_at
  });
});

// Create product
const createProductSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  price: z.number().int().positive()
});

catalogRoutes.post('/products', zValidator('json', createProductSchema), async (c) => {
  await ensureDb(c);
  
  const data = c.req.valid('json');
  const id = generateId();
  const now = Date.now();
  const sku = generateSku(id);
  
  await c.env.DB
    .prepare(`INSERT INTO products (id, title, description, price, currency, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'UAH', 'active', ?, ?)`)
    .bind(id, data.title, data.description || '', data.price, now, now)
    .run();
  
  // Create default variant
  const variantId = generateId();
  await c.env.DB
    .prepare(`INSERT INTO variants (id, product_id, sku, title, price, stock, created_at, updated_at) VALUES (?, ?, ?, 'Default', ?, 10, ?, ?)`)
    .bind(variantId, id, sku, data.price, now, now)
    .run();
  
  return c.json({
    id,
    title: data.title,
    description: data.description || '',
    price: data.price,
    currency: 'UAH',
    status: 'active',
    variants: [{ id: variantId, sku, title: 'Default', price: data.price, stock: 10 }]
  }, 201);
});

// Update product
const updateProductSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().int().positive().optional(),
  status: z.enum(['draft', 'active', 'archived']).optional()
});

catalogRoutes.patch('/products/:id', zValidator('json', updateProductSchema), async (c) => {
  await ensureDb(c);
  
  const id = c.req.param('id');
  const data = c.req.valid('json');
  const now = Date.now();
  
  const fields: string[] = [];
  const values: any[] = [];
  
  if (data.title) { fields.push('title = ?'); values.push(data.title); }
  if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
  if (data.price) { fields.push('price = ?'); values.push(data.price); }
  if (data.status) { fields.push('status = ?'); values.push(data.status); }
  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);
  
  await c.env.DB
    .prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();
  
  const result = await c.env.DB
    .prepare('SELECT * FROM products WHERE id = ?')
    .bind(id)
    .first();
  
  return c.json(result);
});

// Delete product
catalogRoutes.delete('/products/:id', async (c) => {
  await ensureDb(c);
  
  const id = c.req.param('id');
  
  await c.env.DB.prepare('DELETE FROM variants WHERE product_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
  
  return c.json({ success: true });
});

// Categories
catalogRoutes.get('/categories', async (c) => {
  await ensureDb(c);
  
  const result = await c.env.DB
    .prepare('SELECT * FROM categories ORDER BY sort_order ASC')
    .all();
  
  return c.json({
    categories: (result.results || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      order: row.sort_order
    }))
  });
});

const createCategorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional()
});

catalogRoutes.post('/categories', zValidator('json', createCategorySchema), async (c) => {
  await ensureDb(c);
  
  const data = c.req.valid('json');
  const id = generateId();
  const slug = data.slug || data.name.toLowerCase().replace(/\s+/g, '-');
  const now = Date.now();
  
  await c.env.DB
    .prepare(`INSERT INTO categories (id, name, slug, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(id, data.name, slug, data.description || null, now, now)
    .run();
  
  return c.json({ id, name: data.name, slug, description: data.description }, 201);
});

catalogRoutes.delete('/categories/:id', async (c) => {
  await ensureDb(c);
  
  const id = c.req.param('id');
  
  await c.env.DB.prepare('UPDATE products SET category_id = NULL WHERE category_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
  
  return c.json({ success: true });
});
