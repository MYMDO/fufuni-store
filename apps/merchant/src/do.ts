import { DurableObject } from 'cloudflare:workers';
import type { Env, Product, Category, Cart, Order, Discount, StoreConfig } from './types';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  price INTEGER NOT NULL,
  currency TEXT DEFAULT 'USD',
  images TEXT DEFAULT '[]',
  category_id TEXT,
  status TEXT DEFAULT 'draft',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  price INTEGER NOT NULL,
  compare_at_price INTEGER,
  currency TEXT DEFAULT 'USD',
  stock INTEGER DEFAULT 0,
  weight INTEGER,
  options TEXT DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id TEXT,
  image TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS carts (
  id TEXT PRIMARY KEY,
  items TEXT DEFAULT '[]',
  subtotal INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending',
  items TEXT NOT NULL,
  subtotal INTEGER NOT NULL,
  shipping INTEGER DEFAULT 0,
  tax INTEGER DEFAULT 0,
  total INTEGER NOT NULL,
  currency TEXT DEFAULT 'USD',
  customer TEXT NOT NULL,
  shipping_address TEXT,
  stripe_session_id TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS discounts (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  value INTEGER NOT NULL,
  currency TEXT,
  min_purchase INTEGER,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  expires_at INTEGER,
  active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_variants_product ON variants(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(number);
`;

function generateId(): string {
  return crypto.randomUUID();
}

function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `ORD-${timestamp}-${random}`.toUpperCase();
}

export class MerchantDO extends DurableObject {
  private db: SqliteStorage | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    this.db = this.storage;
    this.db.exec(SCHEMA);
    
    const config = await this.getConfig();
    if (!config.storeName) {
      await this.setConfig({
        storeName: 'My Store',
        currency: 'USD',
        currencies: [{ code: 'USD', symbol: '$', rate: 1 }],
        shipping: {
          enabled: true,
          defaultRate: 999,
          rates: []
        },
        tax: {
          enabled: true,
          rate: 0,
          included: false
        }
      });
    }
    
    this.initialized = true;
  }

  async getConfig(): Promise<StoreConfig> {
    await this.initialize();
    const row = this.db!.exec('SELECT value FROM config WHERE key = ?', ['store_config']).next();
    return row ? JSON.parse(row.value) : {} as StoreConfig;
  }

  async setConfig(config: StoreConfig): Promise<void> {
    await this.initialize();
    this.db!.exec(
      'INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)',
      ['store_config', JSON.stringify(config)]
    );
  }

  // Products
  async getProducts(opts: { status?: string; categoryId?: string; limit?: number; cursor?: string } = {}) {
    await this.initialize();
    const { status, categoryId, limit = 50, cursor } = opts;
    
    let query = 'SELECT * FROM products WHERE 1=1';
    const params: any[] = [];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    if (categoryId) {
      query += ' AND category_id = ?';
      params.push(categoryId);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit + 1);
    
    if (cursor) {
      query += ' AND created_at < ?';
      params.push(parseInt(cursor));
    }
    
    const products: any[] = [];
    const rows = this.db!.exec(query, params);
    
    for (const row of rows) {
      const product = this.rowToProduct(row);
      const variants = await this.getVariants(product.id);
      products.push({ ...product, variants });
    }
    
    const hasMore = products.length > limit;
    if (hasMore) products.pop();
    
    return {
      products,
      nextCursor: hasMore ? products[products.length - 1]?.createdAt?.toString() : null
    };
  }

  async getProduct(id: string) {
    await this.initialize();
    const row = this.db!.exec('SELECT * FROM products WHERE id = ?', [id]).next();
    if (!row) return null;
    
    const product = this.rowToProduct(row);
    const variants = await this.getVariants(id);
    return { ...product, variants };
  }

  async createProduct(data: { title: string; description?: string; price: number; categoryId?: string }) {
    await this.initialize();
    const id = generateId();
    const now = Date.now();
    
    this.db!.exec(
      `INSERT INTO products (id, title, description, price, currency, category_id, status, created_at, updated_at) 
       VALUES (?, ?, ?, ?, 'USD', ?, 'draft', ?, ?)`,
      [id, data.title, data.description || '', data.price, data.categoryId || null, now, now]
    );
    
    return this.getProduct(id);
  }

  async updateProduct(id: string, data: Partial<Product>) {
    await this.initialize();
    const now = Date.now();
    const fields: string[] = [];
    const values: any[] = [];
    
    if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
    if (data.price !== undefined) { fields.push('price = ?'); values.push(data.price); }
    if (data.categoryId !== undefined) { fields.push('category_id = ?'); values.push(data.categoryId); }
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    if (data.images !== undefined) { fields.push('images = ?'); values.push(JSON.stringify(data.images)); }
    
    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);
    
    this.db!.exec(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.getProduct(id);
  }

  async deleteProduct(id: string) {
    await this.initialize();
    this.db!.exec('DELETE FROM products WHERE id = ?', [id]);
    return { success: true };
  }

  // Variants
  async getVariants(productId: string) {
    await this.initialize();
    const rows = this.db!.exec('SELECT * FROM variants WHERE product_id = ?', [productId]);
    return rows.map(row => this.rowToVariant(row));
  }

  async createVariant(productId: string, data: Partial<import('./types').Variant>) {
    await this.initialize();
    const id = generateId();
    const now = Date.now();
    
    this.db!.exec(
      `INSERT INTO variants (id, product_id, sku, title, price, compare_at_price, currency, stock, weight, options, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?, ?)`,
      [
        id, productId, data.sku || id, data.title || 'Default',
        data.price || 0, data.compareAtPrice || null,
        data.stock ?? 0, data.weight || null, JSON.stringify(data.options || {})
        , now, now
      ]
    );
    
    const rows = this.db!.exec('SELECT * FROM variants WHERE id = ?', [id]);
    return this.rowToVariant(rows.next()!);
  }

  async updateVariant(id: string, data: Partial<import('./types').Variant>) {
    await this.initialize();
    const now = Date.now();
    const fields: string[] = [];
    const values: any[] = [];
    
    if (data.sku !== undefined) { fields.push('sku = ?'); values.push(data.sku); }
    if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }
    if (data.price !== undefined) { fields.push('price = ?'); values.push(data.price); }
    if (data.compareAtPrice !== undefined) { fields.push('compare_at_price = ?'); values.push(data.compareAtPrice); }
    if (data.stock !== undefined) { fields.push('stock = ?'); values.push(data.stock); }
    if (data.weight !== undefined) { fields.push('weight = ?'); values.push(data.weight); }
    if (data.options !== undefined) { fields.push('options = ?'); values.push(JSON.stringify(data.options)); }
    
    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);
    
    this.db!.exec(`UPDATE variants SET ${fields.join(', ')} WHERE id = ?`, values);
    
    const rows = this.db!.exec('SELECT * FROM variants WHERE id = ?', [id]);
    return this.rowToVariant(rows.next()!);
  }

  async deleteVariant(id: string) {
    await this.initialize();
    this.db!.exec('DELETE FROM variants WHERE id = ?', [id]);
    return { success: true };
  }

  // Categories
  async getCategories() {
    await this.initialize();
    const rows = this.db!.exec('SELECT * FROM categories ORDER BY sort_order ASC, name ASC');
    return rows.map(row => this.rowToCategory(row));
  }

  async getCategory(id: string) {
    await this.initialize();
    const row = this.db!.exec('SELECT * FROM categories WHERE id = ?', [id]).next();
    return row ? this.rowToCategory(row) : null;
  }

  async createCategory(data: { name: string; slug?: string; description?: string; parentId?: string }) {
    await this.initialize();
    const id = generateId();
    const now = Date.now();
    const slug = data.slug || data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    this.db!.exec(
      `INSERT INTO categories (id, name, slug, description, parent_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, slug, data.description || null, data.parentId || null, now, now]
    );
    
    return this.getCategory(id);
  }

  async deleteCategory(id: string) {
    await this.initialize();
    this.db!.exec('UPDATE products SET category_id = NULL WHERE category_id = ?', [id]);
    this.db!.exec('DELETE FROM categories WHERE id = ?', [id]);
    return { success: true };
  }

  // Cart
  async getCart(id: string) {
    await this.initialize();
    const row = this.db!.exec('SELECT * FROM carts WHERE id = ?', [id]).next();
    if (!row) return null;
    return this.rowToCart(row);
  }

  async createCart() {
    await this.initialize();
    const id = generateId();
    const now = Date.now();
    
    this.db!.exec(
      `INSERT INTO carts (id, items, subtotal, currency, created_at, updated_at)
       VALUES (?, '[]', 0, 'USD', ?, ?)`,
      [id, now, now]
    );
    
    return this.getCart(id);
  }

  async addToCart(cartId: string, item: { productId: string; variantId: string; quantity: number }) {
    await this.initialize();
    const cart = await this.getCart(cartId);
    if (!cart) return null;
    
    const product = await this.getProduct(item.productId);
    if (!product) return null;
    
    const variant = product.variants.find(v => v.id === item.variantId);
    if (!variant) return null;
    
    const existingIndex = cart.items.findIndex(i => i.variantId === item.variantId);
    
    if (existingIndex >= 0) {
      cart.items[existingIndex].quantity += item.quantity;
    } else {
      cart.items.push({
        id: generateId(),
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        price: variant.price,
        title: product.title,
        sku: variant.sku,
        image: product.images[0]
      });
    }
    
    return this.saveCart(cart);
  }

  async updateCartItem(cartId: string, itemId: string, quantity: number) {
    await this.initialize();
    const cart = await this.getCart(cartId);
    if (!cart) return null;
    
    const index = cart.items.findIndex(i => i.id === itemId);
    if (index < 0) return cart;
    
    if (quantity <= 0) {
      cart.items.splice(index, 1);
    } else {
      cart.items[index].quantity = quantity;
    }
    
    return this.saveCart(cart);
  }

  async removeFromCart(cartId: string, itemId: string) {
    return this.updateCartItem(cartId, itemId, 0);
  }

  async clearCart(cartId: string) {
    await this.initialize();
    const now = Date.now();
    this.db!.exec(
      'UPDATE carts SET items = ?, subtotal = ?, updated_at = ? WHERE id = ?',
      ['[]', 0, now, cartId]
    );
    return this.getCart(cartId);
  }

  private async saveCart(cart: Cart): Promise<Cart> {
    const now = Date.now();
    const subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    this.db!.exec(
      'UPDATE carts SET items = ?, subtotal = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify(cart.items), subtotal, now, cart.id]
    );
    
    cart.subtotal = subtotal;
    cart.updatedAt = now;
    return cart;
  }

  // Orders
  async getOrders(opts: { status?: string; limit?: number; cursor?: string } = {}) {
    await this.initialize();
    const { status, limit = 50, cursor } = opts;
    
    let query = 'SELECT * FROM orders WHERE 1=1';
    const params: any[] = [];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit + 1);
    
    if (cursor) {
      query += ' AND created_at < ?';
      params.push(parseInt(cursor));
    }
    
    const orders: any[] = [];
    for (const row of this.db!.exec(query, params)) {
      orders.push(this.rowToOrder(row));
    }
    
    const hasMore = orders.length > limit;
    if (hasMore) orders.pop();
    
    return {
      orders,
      nextCursor: hasMore ? orders[orders.length - 1]?.createdAt?.toString() : null
    };
  }

  async getOrder(id: string) {
    await this.initialize();
    const row = this.db!.exec('SELECT * FROM orders WHERE id = ?', [id]).next();
    return row ? this.rowToOrder(row) : null;
  }

  async getOrderByNumber(number: string) {
    await this.initialize();
    const row = this.db!.exec('SELECT * FROM orders WHERE number = ?', [number]).next();
    return row ? this.rowToOrder(row) : null;
  }

  async createOrder(data: {
    items: import('./types').CartItem[];
    subtotal: number;
    shipping: number;
    tax: number;
    total: number;
    customer: import('./types').CustomerInfo;
    shippingAddress?: import('./types').Address;
    stripeSessionId?: string;
  }) {
    await this.initialize();
    const id = generateId();
    const now = Date.now();
    const number = generateOrderNumber();
    
    this.db!.exec(
      `INSERT INTO orders (id, number, status, items, subtotal, shipping, tax, total, currency, customer, shipping_address, stripe_session_id, created_at, updated_at)
       VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?, ?)`,
      [
        id, number,
        JSON.stringify(data.items.map(i => ({
          id: i.id,
          productId: i.productId,
          variantId: i.variantId,
          title: i.title,
          sku: i.sku,
          price: i.price,
          quantity: i.quantity,
          image: i.image
        }))),
        data.subtotal, data.shipping, data.tax, data.total,
        JSON.stringify(data.customer),
        data.shippingAddress ? JSON.stringify(data.shippingAddress) : null,
        data.stripeSessionId || null,
        now, now
      ]
    );
    
    return this.getOrder(id);
  }

  async updateOrder(id: string, data: Partial<Order>) {
    await this.initialize();
    const now = Date.now();
    const fields: string[] = [];
    const values: any[] = [];
    
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    if (data.trackingNumber !== undefined) { fields.push('tracking_number = ?'); values.push(data.trackingNumber); }
    if (data.trackingUrl !== undefined) { fields.push('tracking_url = ?'); values.push(data.trackingUrl); }
    if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes); }
    
    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);
    
    this.db!.exec(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.getOrder(id);
  }

  async updateOrderByStripeSession(stripeSessionId: string, data: Partial<Order>) {
    await this.initialize();
    const now = Date.now();
    const fields: string[] = [];
    const values: any[] = [];
    
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    
    fields.push('updated_at = ?');
    values.push(now);
    values.push(stripeSessionId);
    
    this.db!.exec(`UPDATE orders SET ${fields.join(', ')} WHERE stripe_session_id = ?`, values);
  }

  // Discounts
  async getDiscounts() {
    await this.initialize();
    const rows = this.db!.exec('SELECT * FROM discounts ORDER BY created_at DESC');
    return rows.map(row => this.rowToDiscount(row));
  }

  async getDiscount(code: string) {
    await this.initialize();
    const row = this.db!.exec('SELECT * FROM discounts WHERE code = ? AND active = 1', [code]).next();
    if (!row) return null;
    
    const discount = this.rowToDiscount(row);
    
    if (discount.expiresAt && discount.expiresAt < Date.now()) return null;
    if (discount.maxUses && discount.usedCount >= discount.maxUses) return null;
    
    return discount;
  }

  async createDiscount(data: {
    code: string;
    type: 'percentage' | 'fixed';
    value: number;
    minPurchase?: number;
    maxUses?: number;
    expiresAt?: number;
  }) {
    await this.initialize();
    const id = generateId();
    
    this.db!.exec(
      `INSERT INTO discounts (id, code, type, value, min_purchase, max_uses, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.code.toUpperCase(), data.type, data.value, data.minPurchase || null, data.maxUses || null, data.expiresAt || null, Date.now()]
    );
    
    const rows = this.db!.exec('SELECT * FROM discounts WHERE id = ?', [id]);
    return this.rowToDiscount(rows.next()!);
  }

  async deleteDiscount(id: string) {
    await this.initialize();
    this.db!.exec('DELETE FROM discounts WHERE id = ?', [id]);
    return { success: true };
  }

  // Row converters
  private rowToProduct(row: any): Product {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      price: row.price,
      currency: row.currency,
      images: JSON.parse(row.images || '[]'),
      categoryId: row.category_id,
      status: row.status,
      variants: [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private rowToVariant(row: any): import('./types').Variant {
    return {
      id: row.id,
      sku: row.sku,
      title: row.title,
      price: row.price,
      compareAtPrice: row.compare_at_price,
      currency: row.currency,
      stock: row.stock,
      weight: row.weight,
      options: JSON.parse(row.options || '{}')
    };
  }

  private rowToCategory(row: any): Category {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      parentId: row.parent_id,
      image: row.image,
      order: row.sort_order
    };
  }

  private rowToCart(row: any): Cart {
    return {
      id: row.id,
      items: JSON.parse(row.items || '[]'),
      subtotal: row.subtotal,
      currency: row.currency,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private rowToOrder(row: any): Order {
    return {
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
      shippingAddress: row.shipping_address ? JSON.parse(row.shipping_address) : undefined,
      stripeSessionId: row.stripe_session_id,
      trackingNumber: row.tracking_number,
      trackingUrl: row.tracking_url,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private rowToDiscount(row: any): Discount {
    return {
      id: row.id,
      code: row.code,
      type: row.type,
      value: row.value,
      currency: row.currency,
      minPurchase: row.min_purchase,
      maxUses: row.max_uses,
      usedCount: row.used_count,
      expiresAt: row.expires_at,
      active: !!row.active
    };
  }
}
