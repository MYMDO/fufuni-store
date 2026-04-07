import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../types';
import { getDO, requireAuth } from '../lib/helpers';

export const adminRoutes = new Hono<{ Bindings: Env }>();

// All admin routes require authentication
adminRoutes.use('*', requireAuth('admin'));

// Dashboard stats
adminRoutes.get('/admin/stats', async (c) => {
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  const { orders } = await doStub.getOrders({ limit: 100 });
  const { products } = await doStub.getProducts({ limit: 1000 });
  
  const totalRevenue = orders
    .filter(o => ['paid', 'processing', 'shipped', 'delivered'].includes(o.status))
    .reduce((sum, o) => sum + o.total, 0);
  
  const totalOrders = orders.length;
  const totalProducts = products.length;
  const totalCustomers = new Set(orders.map(o => o.customer?.email)).size;
  
  const ordersByStatus = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const recentOrders = orders.slice(0, 10);
  
  const topProducts = products
    .map(p => {
      const orderCount = orders.reduce((count, o) => {
        return count + o.items.filter(i => i.productId === p.id).reduce((sum, i) => sum + i.quantity, 0);
      }, 0);
      return { ...p, orderCount };
    })
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, 5);
  
  return c.json({
    stats: {
      totalRevenue,
      totalOrders,
      totalProducts,
      totalCustomers,
      averageOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0
    },
    ordersByStatus,
    recentOrders,
    topProducts
  });
});

// Orders management
adminRoutes.get('/admin/orders', async (c) => {
  const status = c.req.query('status') || undefined;
  const limit = parseInt(c.req.query('limit') || '50');
  const cursor = c.req.query('cursor') || undefined;
  
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  const result = await doStub.getOrders({ status, limit, cursor });
  
  return c.json({
    orders: result.orders,
    nextCursor: result.nextCursor
  });
});

adminRoutes.get('/admin/orders/:id', async (c) => {
  const id = c.req.param('id');
  
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  const order = await doStub.getOrder(id);
  
  if (!order) {
    return c.json({ error: 'Order not found' }, 404);
  }
  
  return c.json(order);
});

const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']),
  trackingNumber: z.string().optional(),
  trackingUrl: z.string().url().optional(),
  notes: z.string().optional()
});

adminRoutes.patch('/admin/orders/:id', zValidator('json', updateOrderStatusSchema), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');
  
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  const order = await doStub.updateOrder(id, data);
  
  if (!order) {
    return c.json({ error: 'Order not found' }, 404);
  }
  
  return c.json(order);
});

// Discounts management
adminRoutes.get('/admin/discounts', async (c) => {
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  const discounts = await doStub.getDiscounts();
  
  return c.json({ discounts });
});

const createDiscountSchema = z.object({
  code: z.string().min(3).max(50),
  type: z.enum(['percentage', 'fixed']),
  value: z.number().positive(),
  minPurchase: z.number().int().nonnegative().optional(),
  maxUses: z.number().int().positive().optional(),
  expiresAt: z.number().int().positive().optional()
});

adminRoutes.post('/admin/discounts', zValidator('json', createDiscountSchema), async (c) => {
  const data = c.req.valid('json');
  
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  const discount = await doStub.createDiscount(data);
  
  return c.json(discount, 201);
});

adminRoutes.delete('/admin/discounts/:id', async (c) => {
  const id = c.req.param('id');
  
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  await doStub.deleteDiscount(id);
  
  return c.json({ success: true });
});

// Store config management
adminRoutes.get('/admin/config', async (c) => {
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  const config = await doStub.getConfig();
  
  return c.json(config);
});

// Image upload (placeholder - would need R2 integration)
const uploadImageSchema = z.object({
  filename: z.string(),
  contentType: z.string(),
  data: z.string() // base64 encoded
});

adminRoutes.post('/admin/images', zValidator('json', uploadImageSchema), async (c) => {
  const { filename, contentType, data } = c.req.valid('json');
  
  // In production, upload to R2
  // For now, return a placeholder URL
  const key = crypto.randomUUID() + '-' + filename;
  const url = `${c.env.IMAGES_URL || 'https://your-r2.workers.dev'}/${key}`;
  
  return c.json({
    url,
    key,
    filename,
    contentType
  });
});

// Image deletion
adminRoutes.delete('/admin/images/:key', async (c) => {
  const key = c.req.param('key');
  
  // In production, delete from R2
  // For now, just acknowledge
  return c.json({ success: true, key });
});

// Export data
adminRoutes.get('/admin/export/orders', async (c) => {
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  const { orders } = await doStub.getOrders({ limit: 10000 });
  
  const csv = [
    'Order Number,Status,Email,Items,Subtotal,Shipping,Tax,Total,Currency,Created At',
    ...orders.map(o => [
      o.number,
      o.status,
      o.customer?.email || '',
      o.items.map(i => `${i.title} x${i.quantity}`).join('; '),
      o.subtotal / 100,
      o.shipping / 100,
      o.tax / 100,
      o.total / 100,
      o.currency,
      new Date(o.createdAt).toISOString()
    ].join(','))
  ].join('\n');
  
  return c.text(csv, 200, {
    'Content-Type': 'text/csv',
    'Content-Disposition': `attachment; filename="orders-${new Date().toISOString().split('T')[0]}.csv"`
  });
});
