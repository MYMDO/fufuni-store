# 🛍️ Fufuni Store

**Повністю безкоштовний Serverless інтернет-магазин на Cloudflare Workers & Pages**

[![Deploy to Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com/)
[![License: CC0-1.0](https://img.shields.io/badge/License-CC0--1.0-blue.svg)](http://creativecommons.org/publicdomain/zero/1.0/)

---

## 🚀 Особливості

- **100% безкоштовний хостинг** — Cloudflare Workers, Pages, R2, KV
- **Serverless архітектура** — немає серверів, масштабується автоматично
- **Durable Objects** — SQLite база даних на edge
- **Stripe Checkout** — інтеграція платежів
- **Preact фронтенд** — сучасний UI
- **Адмін-панель** — керування товарами та замовленнями
- **Українська локалізація**

---

## 📊 Безкоштовні ліміти

| Сервіс | Free Tier | Призначення |
|--------|-----------|-------------|
| Cloudflare Workers | 100,000 запитів/день | Backend API |
| Cloudflare R2 | 10 GB | Зображення товарів |
| Cloudflare KV | 1 GB | Кешування |
| GitHub Pages | Необмежено | Фронтенд хостинг |

---

## 🏗️ Архітектура

```
┌─────────────────────────────────────────────────────────────┐
│                         GitHub                              │
│  ┌─────────────────┐     ┌──────────────────────────────┐ │
│  │  GitHub Pages   │     │  GitHub Actions (CI/CD)       │ │
│  │  (Фронтенд)     │     │  Автоматичний деплой          │ │
│  └─────────────────┘     └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Edge                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Cloudflare Workers                       │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────┐  │  │
│  │  │  Hono API  │──│ Durable   │──│  KV Cache      │  │  │
│  │  │  (Routes)  │  │ Objects  │  │                │  │  │
│  │  └────────────┘  │ (SQLite) │  └────────────────┘  │  │
│  │                  └────────────┘                       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Швидкий старт

### 1. Клонування репозиторію

```bash
git clone https://github.com/MYMDO/fufuni-store.git
cd fufuni-store
```

### 2. Встановлення залежностей

```bash
npm install -w apps/merchant -w apps/client
```

### 3. Налаштування Cloudflare

```bash
# Встановіть Wrangler CLI
npm install -g wrangler

# Авторизуйтесь
wrangler login

# Створіть R2 bucket
wrangler r2 bucket create fufuni-images

# Створіть KV namespace
wrangler kv:namespace create KV_CACHE
```

### 4. Локальний запуск

```bash
# Backend (в одному терміналі)
cd apps/merchant
npm run dev

# Frontend (в іншому терміналі)
cd apps/client
npm run dev
```

Відкрийте http://localhost:5173

### 5. Деплой

```bash
# Деплой Worker
cd apps/merchant
wrangler deploy

# Деплой Frontend (GitHub Pages)
# Пуш на main автоматично запустить GitHub Actions
```

---

## 📁 Структура проекту

```
fufuni-store/
├── apps/
│   ├── merchant/           # Cloudflare Worker (Backend)
│   │   ├── src/
│   │   │   ├── index.ts    # Головний файл Worker
│   │   │   ├── do.ts       # Durable Object
│   │   │   ├── types.ts    # TypeScript типи
│   │   │   ├── routes/     # API routes
│   │   │   ├── lib/        # Допоміжні функції
│   │   │   └── middleware/  # Middleware
│   │   ├── migrations/     # SQL міграції
│   │   ├── wrangler.jsonc  # Wrangler конфіг
│   │   └── package.json
│   │
│   └── client/             # Frontend (Preact)
│       ├── index.html      # HTML шаблон
│       ├── app.js          # Preact додаток
│       ├── vite.config.js  # Vite конфіг
│       └── package.json
│
├── scripts/                # Скрипти
│   └── seed.js            # Демо-дані
│
├── .github/
│   └── workflows/          # GitHub Actions
│
├── package.json           # Monorepo root
└── README.md
```

---

## 🌐 API Endpoints

### Публічні

| Метод | Endpoint | Опис |
|-------|----------|------|
| GET | `/v1/products` | Список товарів |
| GET | `/v1/products/:id` | Один товар |
| GET | `/v1/categories` | Категорії |
| GET | `/v1/cart/:id` | Кошик |
| POST | `/v1/checkout` | Оформлення замовлення |

### Адмін

| Метод | Endpoint | Опис |
|-------|----------|------|
| POST | `/v1/products` | Створити товар |
| PATCH | `/v1/products/:id` | Оновити товар |
| DELETE | `/v1/products/:id` | Видалити товар |
| GET | `/v1/admin/orders` | Список замовлень |
| PATCH | `/v1/admin/orders/:id` | Оновити замовлення |

---

## ⚙️ Налаштування

### Змінні середовища (Worker)

Створіть `.dev.vars` в `apps/merchant/`:

```bash
MERCHANT_PK=pk_your_public_key
MERCHANT_SK=sk_your_secret_key
STORE_NAME=Мій Магазин
STORE_URL=https://your-domain.com
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

### Secrets для GitHub Actions

У репозиторії: **Settings → Secrets and variables → Actions**

| Secret | Опис |
|--------|------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |
| `MERCHANT_PK` | Публічний API ключ |
| `MERCHANT_SK` | Секретний API ключ |
| `STORE_NAME` | Назва магазину |
| `STORE_URL` | URL магазину |
| `STRIPE_PUBLISHABLE_KEY` | Stripe Publishable Key |

---

## 🛠️ Технології

**Backend:**
- [Cloudflare Workers](https://workers.cloudflare.com/) — Edge runtime
- [Hono](https://hono.dev/) — Веб-фреймворк
- [Zod](https://zod.dev/) — Валідація схем
- [Durable Objects](https://developers.cloudflare.com/durable-objects/) — SQLite на edge

**Frontend:**
- [Preact](https://preactjs.com/) — Легкий React
- [htm](https://github.com/developit/htm) — JSX без компіляції
- [Vite](https://vitejs.dev/) — Збірка

**Infrastructure:**
- [Cloudflare R2](https://developers.cloudflare.com/r2/) — Object storage
- [Cloudflare KV](https://developers.cloudflare.com/kv/) — Key-value storage
- [GitHub Pages](https://pages.github.com/) — Хостинг

---

## 📝 Ліцензія

Цей проект распрострується під **[CC0 1.0 Universal](http://creativecommons.org/publicdomain/zero/1.0/)** — публічна ділянка.

Ви можете вільно використовувати, модифікувати та розповсюджувати цей код без будь-яких обмежень.

---

## 🤝 Посилання

- [Документація Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Hono Documentation](https://hono.dev/)
- [Durable Objects Documentation](https://developers.cloudflare.com/durable-objects/)

---

*Зроблено з ❤️ на Cloudflare Workers*
