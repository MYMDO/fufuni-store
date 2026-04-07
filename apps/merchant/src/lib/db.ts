import type { D1Database } from '@cloudflare/workers-types';

export function generateId(): string {
  return crypto.randomUUID();
}

export function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `ORD-${timestamp}-${random}`.toUpperCase();
}

export function generateSku(id: string): string {
  return id.substring(0, 8).toUpperCase();
}

export async function initDatabase(db: D1Database): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      price INTEGER NOT NULL,
      currency TEXT DEFAULT 'UAH',
      images TEXT DEFAULT '[]',
      category_id TEXT,
      status TEXT DEFAULT 'draft',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS variants (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      sku TEXT NOT NULL,
      title TEXT NOT NULL,
      price INTEGER NOT NULL,
      compare_at_price INTEGER,
      currency TEXT DEFAULT 'UAH',
      stock INTEGER DEFAULT 0,
      weight INTEGER,
      options TEXT DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      parent_id TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS carts (
      id TEXT PRIMARY KEY,
      items TEXT DEFAULT '[]',
      subtotal INTEGER DEFAULT 0,
      currency TEXT DEFAULT 'UAH',
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
      currency TEXT DEFAULT 'UAH',
      customer TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_variants_product ON variants(product_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  `);
}
