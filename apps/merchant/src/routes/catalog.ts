import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { Env, Product } from '../types';
import { getDO, requireAuth, validatePublicKey } from '../lib/helpers';

export const catalogRoutes = new Hono<{ Bindings: Env }>();

// Get all products
catalogRoutes.get('/products', validatePublicKey, async (c) => {
  const status = c.req.query('status') || 'active';
  const categoryId = c.req.query('categoryId') || undefined;
  const limit = parseInt(c.req.query('limit') || '50');
  const cursor = c.req.query('cursor') || undefined;
  
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  const result = await doStub.getProducts({ status, categoryId, limit, cursor });
  
  return c.json({
    products: result.products,
    nextCursor: result.nextCursor,
    total: result.products.length
  });
});

// Search products
catalogRoutes.get('/products/search', validatePublicKey, async (c) => {
  const q = c.req.query('q')?.toLowerCase() || '';
  const limit = parseInt(c.req.query('limit') || '20');
  
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  const { products } = await doStub.getProducts({ status: 'active', limit: 100 });
  
  const filtered = products.filter(p => 
    p.title.toLowerCase().includes(q) ||
    p.description?.toLowerCase().includes(q) ||
    p.variants?.some(v => v.sku.toLowerCase().includes(q))
  ).slice(0, limit);
  
  return c.json({ products: filtered, total: filtered.length });
});

// Get single product
catalogRoutes.get('/products/:id', validatePublicKey, async (c) => {
  const id = c.req.param('id');
  
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  const product = await doStub.getProduct(id);
  
  if (!product) {
    return c.json({ error: 'Product not found' }, 404);
  }
  
  return c.json(product);
});

// Create product (admin)
const createProductSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  price: z.number().int().positive(),
  categoryId: z.string().optional()
});

catalogRoutes.post('/products', zValidator('json', createProductSchema), requireAuth('admin'), async (c) => {
  const data = c.req.valid('json');
  
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  const product = await doStub.createProduct(data);
  
  // Create default variant
  await doStub.createVariant(product!.id, {
    sku: product!.id.substring(0, 8).toUpperCase(),
    title: 'Default',
    price: data.price,
    stock: 0
  });
  
  return c.json(product, 201);
});

// Update product (admin)
const updateProductSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().int().positive().optional(),
  categoryId: z.string().nullable().optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  images: z.array(z.string()).optional()
});

catalogRoutes.patch('/products/:id', zValidator('json', updateProductSchema), requireAuth('admin'), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');
  
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  const product = await doStub.updateProduct(id, data);
  
  if (!product) {
    return c.json({ error: 'Product not found' }, 404);
  }
  
  return c.json(product);
});

// Delete product (admin)
catalogRoutes.delete('/products/:id', requireAuth('admin'), async (c) => {
  const id = c.req.param('id');
  
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  await doStub.deleteProduct(id);
  
  return c.json({ success: true });
});

// Product Variants
const createVariantSchema = z.object({
  sku: z.string().min(1),
  title: z.string().min(1),
  price: z.number().int().positive(),
  compareAtPrice: z.number().int().positive().optional(),
  stock: z.number().int().nonnegative().default(0),
  weight: z.number().positive().optional(),
  options: z.record(z.string()).optional()
});

catalogRoutes.post('/products/:id/variants', zValidator('json', createVariantSchema), requireAuth('admin'), async (c) => {
  const productId = c.req.param('id');
  const data = c.req.valid('json');
  
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  const variant = await doStub.createVariant(productId, data);
  
  return c.json(variant, 201);
});

const updateVariantSchema = z.object({
  sku: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  price: z.number().int().positive().optional(),
  compareAtPrice: z.number().int().positive().nullable().optional(),
  stock: z.number().int().nonnegative().optional(),
  weight: z.number().positive().optional(),
  options: z.record(z.string()).optional()
});

catalogRoutes.patch('/products/:productId/variants/:variantId', zValidator('json', updateVariantSchema), requireAuth('admin'), async (c) => {
  const variantId = c.req.param('variantId');
  const data = c.req.valid('json');
  
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  const variant = await doStub.updateVariant(variantId, data);
  
  return c.json(variant);
});

catalogRoutes.delete('/products/:productId/variants/:variantId', requireAuth('admin'), async (c) => {
  const variantId = c.req.param('variantId');
  
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  await doStub.deleteVariant(variantId);
  
  return c.json({ success: true });
});

// Categories
catalogRoutes.get('/categories', async (c) => {
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  const categories = await doStub.getCategories();
  
  return c.json({ categories });
});

catalogRoutes.get('/categories/:id', async (c) => {
  const id = c.req.param('id');
  
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  const category = await doStub.getCategory(id);
  
  if (!category) {
    return c.json({ error: 'Category not found' }, 404);
  }
  
  return c.json(category);
});

const createCategorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional(),
  parentId: z.string().optional()
});

catalogRoutes.post('/categories', zValidator('json', createCategorySchema), requireAuth('admin'), async (c) => {
  const data = c.req.valid('json');
  
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  const category = await doStub.createCategory(data);
  
  return c.json(category, 201);
});

catalogRoutes.delete('/categories/:id', requireAuth('admin'), async (c) => {
  const id = c.req.param('id');
  
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  await doStub.deleteCategory(id);
  
  return c.json({ success: true });
});
