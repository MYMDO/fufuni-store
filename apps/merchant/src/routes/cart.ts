import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../types';
import { getDO } from '../lib/helpers';

export const cartRoutes = new Hono<{ Bindings: Env }>();

// Get cart
cartRoutes.get('/cart/:id', async (c) => {
  const id = c.req.param('id');
  
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  const cart = await doStub.getCart(id);
  
  if (!cart) {
    return c.json({ error: 'Cart not found' }, 404);
  }
  
  return c.json(cart);
});

// Create new cart
cartRoutes.post('/cart', async (c) => {
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  const cart = await doStub.createCart();
  
  return c.json(cart, 201);
});

// Add item to cart
const addToCartSchema = z.object({
  productId: z.string(),
  variantId: z.string(),
  quantity: z.number().int().positive()
});

cartRoutes.post('/cart/:id/items', zValidator('json', addToCartSchema), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');
  
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  const cart = await doStub.addToCart(id, data);
  
  if (!cart) {
    return c.json({ error: 'Cart not found or invalid product/variant' }, 400);
  }
  
  return c.json(cart);
});

// Update cart item quantity
const updateCartItemSchema = z.object({
  quantity: z.number().int().min(0)
});

cartRoutes.patch('/cart/:cartId/items/:itemId', zValidator('json', updateCartItemSchema), async (c) => {
  const cartId = c.req.param('cartId');
  const itemId = c.req.param('itemId');
  const { quantity } = c.req.valid('json');
  
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  const cart = await doStub.updateCartItem(cartId, itemId, quantity);
  
  if (!cart) {
    return c.json({ error: 'Cart not found' }, 404);
  }
  
  return c.json(cart);
});

// Remove item from cart
cartRoutes.delete('/cart/:cartId/items/:itemId', async (c) => {
  const cartId = c.req.param('cartId');
  const itemId = c.req.param('itemId');
  
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  const cart = await doStub.removeFromCart(cartId, itemId);
  
  return c.json(cart);
});

// Clear cart
cartRoutes.delete('/cart/:id', async (c) => {
  const id = c.req.param('id');
  
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  const cart = await doStub.clearCart(id);
  
  return c.json(cart);
});

// Apply discount
cartRoutes.post('/cart/:id/discount', async (c) => {
  const id = c.req.param('id');
  const { code } = await c.req.json<{ code: string }>();
  
  const doId = c.env.MERCHANT_DO.idFromName('main');
  const doStub = c.env.MERCHANT_DO.get(doId);
  
  const cart = await doStub.getCart(id);
  if (!cart) {
    return c.json({ error: 'Cart not found' }, 404);
  }
  
  const discount = await doStub.getDiscount(code.toUpperCase());
  if (!discount) {
    return c.json({ error: 'Invalid or expired discount code' }, 400);
  }
  
  if (discount.minPurchase && cart.subtotal < discount.minPurchase) {
    return c.json({ 
      error: `Minimum purchase of ${discount.minPurchase / 100} required for this discount` 
    }, 400);
  }
  
  let discountAmount = 0;
  if (discount.type === 'percentage') {
    discountAmount = Math.round(cart.subtotal * (discount.value / 100));
  } else {
    discountAmount = discount.value;
  }
  
  return c.json({
    discount: {
      code: discount.code,
      type: discount.type,
      value: discount.value,
      amount: discountAmount
    },
    cart: {
      ...cart,
      discount: discountAmount,
      total: cart.subtotal - discountAmount
    }
  });
});
