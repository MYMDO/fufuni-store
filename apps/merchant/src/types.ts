export interface Env {
  MERCHANT_DO: DurableObjectNamespace;
  IMAGES: R2Bucket;
  KV_CACHE: KVNamespace;
  
  MERCHANT_PK: string;
  MERCHANT_SK: string;
  STORE_NAME: string;
  STORE_URL: string;
  IMAGES_URL: string;
  CORS_ORIGIN: string;
  API_BASE_URL: string;
  STRIPE_PUBLISHABLE_KEY: string;
  KV_CACHE_ID: string;
  
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
  image?: string;
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
  shippingAddress?: Address;
  stripeSessionId?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export type OrderStatus = 
  | 'pending' 
  | 'paid' 
  | 'processing' 
  | 'shipped' 
  | 'delivered' 
  | 'cancelled' 
  | 'refunded';

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

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export interface Discount {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  currency?: string;
  minPurchase?: number;
  maxUses?: number;
  usedCount: number;
  expiresAt?: number;
  active: boolean;
}

export interface StoreConfig {
  storeName: string;
  currency: string;
  currencies: Currency[];
  shipping: ShippingConfig;
  tax: TaxConfig;
}

export interface Currency {
  code: string;
  symbol: string;
  rate: number;
}

export interface ShippingConfig {
  enabled: boolean;
  freeThreshold?: number;
  defaultRate: number;
  rates: ShippingRate[];
}

export interface ShippingRate {
  id: string;
  name: string;
  price: number;
  currency: string;
  estimatedDays: number;
  countries: string[];
}

export interface TaxConfig {
  enabled: boolean;
  rate: number;
  included: boolean;
}
