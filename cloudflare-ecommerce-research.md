# Serverless Інтернет-магазин на Cloudflare Pages: Повне Безкоштовне Рішення

> **Відповідь: Так, це можливо!** На основі дослідження Cloudflare Free Tier (стан: квітень 2026)

---

## Можливості Cloudflare Pages/Workers Free Tier

### Безкоштовні ресурси

| Сервіс | Ліміт Free | Примітка |
|--------|-----------|----------|
| **Workers/Workers Pages** | 100,000 запитів/день | CPU: 10ms/invocation |
| **D1 (SQLite база)** | 5M рядків читань/день, 100K записів/день | Макс. 500MB база |
| **R2 (S3 storage)** | 10 GB storage | 0 egress (безкоштовний вихід) |
| **KV (кеш)** | 1 GB storage | 100K читань/день |
| **Durable Objects** | 100K запитів/день | SQLite backend only |
| **Pages Builds** | 500 білдів/місяць | Таймаут 20 хвилин |
| **Custom Domains** | 100 на проект | — |
| **Files** | 20,000 файлів | Макс. 25MB на файл |
| **Hyperdrive** | 100,000 запитів/день | Підключення до зовнішніх БД |

### Практичні обмеження для e-commerce

| Аспект | Ліміт | Вплив |
|--------|-------|-------|
| D1 розмір бази | 500MB (Free) | ~50-100k товарів текстових даних |
| R2 storage | 10GB | ~1000-2000 товарних фото (при стисненні WebP) |
| Workers CPU | 10ms/request | Можливість "гарячих" reads через кеш |
| D1 read replication | Доступно | Зниження латентності для read-heavy навантаження |
| Кількість D1 баз | 10 | Можливість шардингу при потребі |

---

## Готові рішення

### 1. Fufuni — "100% Free-tier E-commerce Framework"

**Репозиторій**: https://github.com/sctg-development/fufuni  
**Демо**: https://sctg-development.github.io/fufuni/

**Повноцінний opensource магазин з нульовою вартістю:**

| Компонент | Free Tier | Використання |
|-----------|-----------|--------------|
| Cloudflare Workers | 100k req/day | Backend API + Durable Objects SQLite |
| Cloudflare R2 | 10 GB storage | Product images & assets |
| Auth0 | 7,500 active users | Auth passwordless + social |
| Mailgun | 1,000 emails/month | Order notifications |
| Stripe | Pay-as-you-go | Payments (no monthly fee) |
| GitHub Pages | Unlimited | SPA frontend hosting |

**Функціонал:**
- Каталог товарів з варіантами (SKU, кольори, розміри)
- Багатомовність (6 локалів: EN, FR, ES, ZH, AR, HE)
- Stripe Checkout з webhook reconciliation
- AI-трансляції (клієнт-сайд, без витоку ключів)
- Панель адміністратора
- Система доставки з калькулятором ваги
- Кешування через KV + CDN
- Universal Commerce Protocol (UCP) для AI-агентів

### 2. Cloudflare Official Tutorial

**Посилання**: [Using D1 Read Replication for e-commerce](https://developers.cloudflare.com/d1/tutorials/using-read-replication-for-e-com/)

Офіційний покроковий туторіал з:
- Створенням D1 бази
- Налаштуванням read replication
- API для CRUD операцій
- Retry логікою
- Прикладом деплою

**Репозиторій прикладу**: https://github.com/harshil1712/e-com-d1-hono

### 3. Shopify + D1 Template

**Репозиторій**: https://github.com/gruntlord5/cloudflare-worker-shopifyd1

Shopify App Template для Cloudflare Workers + D1

---

## Рекомендована Архітектура

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   Frontend: Cloudflare Pages / GitHub Pages              │
│   ┌─────────────────────────────────────────────────┐   │
│   │  React/Vue/Svelte SPA + HeroUI                  │   │
│   │  Static Hosting → Zero Cost                     │   │
│   └─────────────────────────────────────────────────┘   │
│                                                         │
└────────────────────┬────────────────────────────────────┘
                     │ API Calls
┌────────────────────▼────────────────────────────────────┐
│                                                         │
│   Cloudflare Workers + Hono/Zod                         │
│   ┌─────────────────────────────────────────────────┐   │
│   │  Durable Objects (SQLite) — orders, products   │   │
│   │  D1 — read replicas для catalog reads           │   │
│   │  R2 — product images storage                   │   │
│   │  KV — caching layer                            │   │
│   └─────────────────────────────────────────────────┘   │
│                                                         │
└────────────────────┬────────────────────────────────────┘
                     │ Webhooks
┌────────────────────▼────────────────────────────────────┐
│                                                         │
│   Stripe Checkout / Lemon Squeezy / Paddle              │
│   ┌─────────────────────────────────────────────────┐   │
│   │  Payment processing (2.9% + $0.30 per tx)      │   │
│   │  Subscription handling                          │   │
│   │  Refund management                              │   │
│   └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Варіанти Backend

#### Варіант A: Durable Objects (рекомендовано)
```
Доступність: Free Tier ✓
Переваги:
  - 100% stateful, zero cold start
  - SQLite built-in
  - Автоматична синхронізація
Обмеження:
  - Storage billing starting Jan 2026
```

#### Варіант B: D1 з Read Replication
```
Доступність: Free Tier ✓
Переваги:
  - Global read replicas
  - Time Travel (7 days Free)
  - 500MB max per DB
Обмеження:
  - 50 queries per Worker invocation (Free)
```

---

## Порівняння Payment Gateways

| Провайдер | Monthly Fee | Transaction Fee | Digital Goods | Notes |
|-----------|-------------|-----------------|--------------|-------|
| **Stripe** | $0 | 2.9% + $0.30 | ✓ | Industry standard |
| **Lemon Squeezy** | $0 | 5% + $0.50 | ✓ | EU VAT handling |
| **Paddle** | $0 | 5% + $0.50 | ✓ | Global tax handling |
| **Gumroad** | $0 | 10% | ✓ | Simple, Creator-focused |
| **PayPal** | $0 | 3.49% + $0.49 | ✓ | Wide adoption |

**Рекомендація**: Stripe для контролю + Lemon Squeezy/Paddle для EU VAT compliance

---

## Безкоштовні інтеграції

| Сервіс | Free Tier | Примітка |
|--------|-----------|----------|
| **Auth0** | 7,500 DAU, 50MF Universal Login ops | Passwordless + Social |
| **SendGrid** | 100 emails/day | Transactional |
| **Mailgun** | 1,000 emails/month | API-based |
| **Resend** | 3,000 emails/day | Developer-friendly |
| **Resend** | 100 emails/day (free forever) | Starter tier |

---

## Що підходить, а що ні

### Підходить для:
- ✅ Micro/nano store (до ~100-500 товарів)
- ✅ Малі обсяги продажів (<2,000 замовлень/місяць)
- ✅ Digital goods (софт, книги, підписки, мерч)
- ✅ MVP та прототипи
- ✅ Навчальні проекти
- ✅ Side-projects та експерименти

### Може бути проблемою для:
- ⚠️ Великої кількості товарів (>500) — D1 однопотоковий
- ⚠️ Складних операцій фільтрації — потрібне індексування
- ⚠️ SEO-intensive каталогів — потрібне SSR (Workers SSR prerender)
- ⚠️ Високих навантажень (>100k відвідувачів/день)
- ⚠️ Real-time inventory — eventual consistency D1

---

## Quick Start: Fufuni (рекомендовано)

```bash
# 1. Fork репозиторій
git clone https://github.com/sctg-development/fufuni

# 2. Backend
cd apps/merchant
npx wrangler d1 create store
# Налаштувати wrangler.jsonc

# 3. Frontend
cp apps/client/.env.example apps/client/.env
# Заповнити AUTH0_*, API_BASE_URL, MERCHANT_PK

# 4. Deploy
cd apps/merchant && wrangler deploy
```

---

## Висновок

**Так, можливо створити повністю безкоштовний mini/micro serverless інтернет-магазин на Cloudflare Pages.**

### Оптимальний Zero-Cost Stack

| Layer | Service | Free Limit |
|-------|---------|------------|
| Frontend | Cloudflare Pages | Unlimited |
| Backend | Workers | 100k req/day |
| Database | D1 / Durable Objects | 500MB / 5GB |
| Storage | R2 | 10GB |
| Cache | KV | 1GB |
| Payments | Stripe | Pay-as-you-go |
| Auth | Auth0 | 7,500 DAU |
| Email | Mailgun/Resend | 1,000-3,000/month |

**Fufuni** — production-ready рішення з повним функціоналом. Ідеальний відправний пункт для MVP та micro-stores.

---

*Документ створено на основі дослідження: квітень 2026*  
*Джерела: [Cloudflare Docs](https://developers.cloudflare.com/), [Fufuni GitHub](https://github.com/sctg-development/fufuni), [D1 E-commerce Tutorial](https://developers.cloudflare.com/d1/tutorials/using-read-replication-for-e-com/)*
