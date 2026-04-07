import type { Context, Next } from 'hono';
import type { Env } from '../types';

export async function kvCacheMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  // Only cache GET requests to specific endpoints
  if (c.req.method !== 'GET') {
    return next();
  }
  
  const path = new URL(c.req.url).pathname;
  const cacheablePaths = ['/v1/products', '/v1/categories'];
  
  const shouldCache = cacheablePaths.some(p => path.startsWith(p));
  
  if (!shouldCache) {
    return next();
  }
  
  // Skip if auth header present (admin requests)
  const auth = c.req.header('Authorization');
  if (auth) {
    return next();
  }
  
  const cacheKey = `cache:${path}:${c.req.url.search || ''}`;
  
  try {
    const cached = await c.env.KV_CACHE.get(cacheKey, 'json');
    
    if (cached) {
      c.header('X-KV-Cache', 'HIT');
      return c.json(cached);
    }
  } catch (e) {
    // KV might not be configured
  }
  
  c.header('X-KV-Cache', 'MISS');
  
  await next();
  
  // Cache successful responses
  if (c.res.status === 200) {
    try {
      const data = await c.res.clone().json();
      await c.env.KV_CACHE.put(cacheKey, JSON.stringify(data), {
        expirationTtl: 300 // 5 minutes
      });
    } catch (e) {
      // Ignore cache errors
    }
  }
}

export async function invalidateCache(kv: KVNamespace, patterns: string[]) {
  for (const pattern of patterns) {
    try {
      const keys = await kv.list({ prefix: `cache:${pattern}` });
      for (const key of keys.keys) {
        await kv.delete(key.name);
      }
    } catch (e) {
      // Ignore errors
    }
  }
}
