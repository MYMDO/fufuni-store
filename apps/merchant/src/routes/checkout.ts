import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { Env, CustomerInfo, Address } from '../types';
import { getDO } from '../lib/helpers';

export const checkoutRoutes = new Hono<{ Bindings: Env }>();

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
    line2: z.string().optional(),
    city: z.string(),
    state: z.string().optional(),
    postalCode: z.string(),
    country: z.string().length(2)
  }).optional(),
  shippingMethod: z.object({
    id: z.string().optional(),
    name: z.string(),
    price: z.number().int()
  }).optional(),
  notes: z.string().optional(),
  discountCode: z.string().optional()
});

checkoutRoutes.post('/checkout', zValidator('json', checkoutSchema), async (c) => {
  const data = c.req.valid('json');
  
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  // Get cart
  const cart = await doStub.getCart(data.cartId);
  if (!cart) {
    return c.json({ error: 'Cart not found' }, 404);
  }
  
  if (cart.items.length === 0) {
    return c.json({ error: 'Cart is empty' }, 400);
  }
  
  // Get store config for tax
  const config = await doStub.getConfig();
  
  // Calculate totals
  const subtotal = cart.subtotal;
  let discountAmount = 0;
  
  // Apply discount if provided
  if (data.discountCode) {
    const discount = await doStub.getDiscount(data.discountCode.toUpperCase());
    if (discount) {
      if (discount.minPurchase && subtotal < discount.minPurchase) {
        return c.json({ 
          error: `Minimum purchase of ${discount.minPurchase / 100} required` 
        }, 400);
      }
      
      if (discount.type === 'percentage') {
        discountAmount = Math.round(subtotal * (discount.value / 100));
      } else {
        discountAmount = discount.value;
      }
    }
  }
  
  const afterDiscount = subtotal - discountAmount;
  
  // Calculate shipping
  let shipping = data.shippingMethod?.price || 0;
  if (config.shipping.enabled && config.shipping.freeThreshold && afterDiscount >= config.shipping.freeThreshold) {
    shipping = 0;
  }
  
  // Calculate tax
  let tax = 0;
  if (config.tax.enabled && !config.tax.included) {
    tax = Math.round(afterDiscount * (config.tax.rate / 100));
  }
  
  const total = afterDiscount + shipping + tax;
  
  // Create order
  const order = await doStub.createOrder({
    items: cart.items,
    subtotal: afterDiscount,
    shipping,
    tax,
    total,
    customer: data.customer,
    shippingAddress: data.shippingAddress,
    stripeSessionId: undefined // Will be updated after Stripe redirect
  });
  
  // Clear cart
  await doStub.clearCart(data.cartId);
  
  // In production, create Stripe Checkout session here
  // For now, return order details
  const checkoutUrl = `${c.env.STORE_URL || 'https://your-store.com'}/checkout/${order!.id}?session_id=demo_${order!.id}`;
  
  return c.json({
    order,
    checkoutUrl,
    paymentRequired: total > 0,
    demo: true,
    message: 'This is a demo checkout. In production, Stripe Checkout would redirect here.'
  });
});

// Get checkout session (for Stripe redirect)
checkoutRoutes.get('/checkout/session/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');
  
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  // In production, verify Stripe session
  // For demo, extract order ID from session
  const orderId = sessionId.replace('demo_', '');
  
  const order = await doStub.getOrder(orderId);
  
  if (!order) {
    return c.json({ error: 'Order not found' }, 404);
  }
  
  return c.json(order);
});

// Get available shipping rates
checkoutRoutes.get('/checkout/shipping-rates', async (c) => {
  const country = c.req.query('country');
  
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  const config = await doStub.getConfig();
  
  if (!config.shipping.enabled) {
    return c.json({ rates: [] });
  }
  
  let rates = config.shipping.rates || [];
  
  // Filter by country if specified
  if (country) {
    rates = rates.filter(r => 
      !r.countries || 
      r.countries.length === 0 || 
      r.countries.includes(country)
    );
  }
  
  return c.json({ 
    rates: rates.map(r => ({
      id: r.id,
      name: r.name,
      price: r.price,
      estimatedDays: r.estimatedDays,
      currency: r.currency || config.currency
    })),
    freeThreshold: config.shipping.freeThreshold
  });
});

// Order confirmation (public)
checkoutRoutes.get('/orders/:id', async (c) => {
  const id = c.req.param('id');
  
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  const order = await doStub.getOrder(id);
  
  if (!order) {
    return c.json({ error: 'Order not found' }, 404);
  }
  
  // Don't expose sensitive data
  return c.json({
    id: order.id,
    number: order.number,
    status: order.status,
    total: order.total,
    currency: order.currency,
    items: order.items,
    createdAt: order.createdAt
  });
});

// Order lookup by number
checkoutRoutes.get('/orders/number/:number', async (c) => {
  const number = c.req.param('number');
  
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  const order = await doStub.getOrderByNumber(number);
  
  if (!order) {
    return c.json({ error: 'Order not found' }, 404);
  }
  
  return c.json({
    id: order.id,
    number: order.number,
    status: order.status,
    total: order.total,
    currency: order.currency,
    createdAt: order.createdAt
  });
});
