import type { Env } from '../types';

export function getDO(env: Env, name = 'main') {
  const id = env.MERCHANT_DO.idFromName(name);
  return env.MERCHANT_DO.get(id);
}

export function validatePublicKey() {
  return async (c: any, next: () => Promise<void>) => {
    const auth = c.req.header('Authorization');
    const publicKey = c.env.MERCHANT_PK;
    
    // Skip validation if no keys configured
    if (!publicKey) {
      await next();
      return;
    }
    
    // Allow requests with valid public key or admin key
    if (auth) {
      const token = auth.replace('Bearer ', '');
      
      // Admin key (starts with sk_)
      if (token.startsWith('sk_') && token === c.env.MERCHANT_SK) {
        c.set('role', 'admin');
        await next();
        return;
      }
      
      // Public key (starts with pk_)
      if (token.startsWith('pk_') && token === publicKey) {
        c.set('role', 'public');
        await next();
        return;
      }
    }
    
    // For now, allow all requests (unauthenticated)
    // In production, you would reject unauthorized requests
    c.set('role', 'guest');
    await next();
  };
}

export function requireAuth(role: 'admin' | 'public' | 'any' = 'admin') {
  return async (c: any, next: () => Promise<void>) => {
    const auth = c.req.header('Authorization');
    
    if (!auth) {
      return c.json({ error: 'Unauthorized - No authorization header' }, 401);
    }
    
    const token = auth.replace('Bearer ', '');
    const adminKey = c.env.MERCHANT_SK;
    const publicKey = c.env.MERCHANT_PK;
    
    if (role === 'admin') {
      if (!adminKey || token !== adminKey) {
        return c.json({ error: 'Unauthorized - Invalid admin key' }, 401);
      }
      c.set('role', 'admin');
    } else if (role === 'public') {
      if (token !== publicKey && token !== adminKey) {
        return c.json({ error: 'Unauthorized - Invalid key' }, 401);
      }
      c.set('role', token === adminKey ? 'admin' : 'public');
    } else {
      if (token !== publicKey && token !== adminKey) {
        return c.json({ error: 'Unauthorized - Invalid key' }, 401);
      }
      c.set('role', token === adminKey ? 'admin' : 'public');
    }
    
    await next();
  };
}

export function formatCurrency(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(cents / 100);
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}
