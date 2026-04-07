export interface Env {
  DB: D1Database;
  KV_CACHE: KVNamespace;
  
  STORE_NAME: string;
  CORS_ORIGIN: string;
  
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  MAILGUN_API_KEY?: string;
  MAILGUN_DOMAIN?: string;
  ORDER_TOKEN_SECRET?: string;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  images: string[];
  categoryId: string | null;
  status: 'draft' | 'active' | 'archived';
  variants: Variant[];
  createdAt: number;
  updatedAt: number;
}

export interface Variant {
  id: string;
  sku: string;
  title: string;
  price: number;
  compareAtPrice?: number;
  currency: string;
  stock: number;
  weight?: number;
  options?: Record<string, string>;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  order: number;
}

export interface CartItem {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  price: number;
  title: string;
  sku: string;
  image?: string;
}

export interface Cart {
  id: string;
  items: CartItem[];
  subtotal: number;
  currency: string;
  createdAt: number;
  updatedAt: number;
}

export interface Order {
  id: string;
  number: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
  customer: CustomerInfo;
  createdAt: number;
  updatedAt: number;
}

export type OrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

export interface OrderItem {
  id: string;
  productId: string;
  variantId: string;
  title: string;
  sku: string;
  price: number;
  quantity: number;
  image?: string;
}

export interface CustomerInfo {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface StoreConfig {
  storeName: string;
  currency: string;
}
