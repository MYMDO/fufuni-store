# Повністю безкоштовний Serverless Інтернет-магазин на Fufuni + Cloudflare Pages

> **Практичний посібник зі встановлення та налаштування**  
> Адаптовано для нового репозиторію на GitHub

---

## Зміст

1. [Вступ](#вступ)
2. [Архітектура рішення](#архітектура-рішення)
3. [Необхідні акаунти та сервіси](#необхідні-акаунти-та-сервіси)
4. [Покрокова інструкція](#покрокова-інструкція)
   - [Крок 1: Підготовка Cloudflare](#крок-1-підготовка-cloudflare)
   - [Крок 2: Створення Auth0 акаунту](#крок-2-створення-auth0-акаунту)
   - [Крок 3: Налаштування Stripe](#крок-3-налаштування-stripe)
   - [Крок 4: Налаштування Mailgun](#крок-4-налаштування-mailgun)
   - [Крок 5: Клонування та налаштування репозиторію](#крок-5-клонування-та-налаштування-репозиторію)
   - [Крок 6: Локальна розробка](#крок-6-локальна-розробка)
   - [Крок 7: Деплой на Cloudflare Workers](#крок-7-деплой-на-cloudflare-workers)
   - [Крок 8: Деплой фронтенду на GitHub Pages](#крок-8-деплой-фронтенду-на-github-pages)
5. [Ініціалізація магазину](#ініціалізація-магазину)
6. [Тестування](#тестування)
7. [Демо-дані](#демо-дані)
8. [GitHub Secrets](#github-secrets)
9. [FAQ та Troubleshooting](#faq-та-troubleshooting)

---

## Вступ

**Fufuni** — це 100% безкоштовний, cloudflare-native фреймворк для інтернет-магазинів з відкритим кодом. Він дозволяє створити повноцінний e-commerce без жодних щомісячних витрат, використовуючи:

| Сервіс | Безкоштовний ліміт | Призначення |
|--------|-------------------|-------------|
| Cloudflare Workers | 100,000 запитів/день | Backend API |
| Cloudflare R2 | 10 GB | Зображення товарів |
| Cloudflare KV | 1 GB | Кешування |
| GitHub Pages | Необмежено | Фронтенд |
| Auth0 | 7,500 користувачів | Авторизація |
| Stripe | Pay-as-you-go | Платежі |
| Mailgun | 1,000 листів/місяць | Email-сповіщення |

### Що входить до комплекту:

- Панель адміністратора
- Каталог товарів з варіантами
- Кошик та оформлення замовлення
- Stripe Checkout інтеграція
- Багатомовність (6 мов)
- Два вбудовані теми (Classic, Luxury)
- AI-трансляції (опціонально)
- Система доставки
- Email-шаблони
- Аналітика

---

## Архітектура рішення

```
┌─────────────────────────────────────────────────────────────────────┐
│                          GitHub Repository                           │
│  ┌──────────────────────┐              ┌──────────────────────────┐  │
│  │   GitHub Pages       │              │   GitHub Actions         │  │
│  │   (Фронтенд SPA)     │              │   (CI/CD)               │  │
│  │   React + HeroUI     │              │   Автоматичний деплой   │  │
│  └──────────────────────┘              └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Cloudflare Edge                               │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    Cloudflare Workers                          │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │ │
│  │  │  Hono API    │  │  Durable     │  │  KV Cache           │ │ │
│  │  │  (Routes)    │──│  Objects     │──│  (Catalog cache)     │ │ │
│  │  │              │  │  (SQLite)    │  │                      │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘ │ │
│  │         │                 │                    │               │ │
│  │         ▼                 ▼                    ▼               │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │ │
│  │  │  R2 Storage  │  │    Stripe    │  │     Mailgun          │ │ │
│  │  │  (Images)    │  │  (Payments)  │  │     (Emails)         │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          Auth0 (Auth)                                │
│  - JWT авторизація                                                   │
│  - Соціальні логіни (Google, GitHub, Apple)                        │
│  - RBAC (ролі та дозволи)                                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Необхідні акаунти та сервіси

Перед початком налаштування підготуйте наступні акаунти:

### Обов'язкові:

1. **Cloudflare Account** — https://dash.cloudflare.com
   - Потрібен для Workers, R2, KV
   - Безкоштовний план достатній

2. **GitHub Account** — https://github.com
   - Для хостингу коду та GitHub Pages
   - Безкоштовний план достатній

3. **Auth0 Account** — https://auth0.com
   - Для авторизації користувачів
   - Free tier: 7,500 активних користувачів

4. **Stripe Account** — https://stripe.com
   - Для обробки платежів
   - Безкоштовний аккаунт (платите лише % від транзакцій)

### Опціональні:

5. **Mailgun Account** — https://www.mailgun.com
   - Для email-сповіщень про замовлення
   - Free tier: 1,000 листів/місяць

---

## Покрокова інструкція

### Крок 1: Підготовка Cloudflare

#### 1.1 Реєстрація та налаштування акаунту

1. Перейдіть на https://dash.cloudflare.com та зареєструйтесь
2. Підтвердіть email
3. Увійдіть в панель керування

#### 1.2 Створення R2 bucket для зображень

```bash
# Встановіть Wrangler CLI (Node.js 16+ потрібен)
npm install -g wrangler

# Авторизуйтесь у Cloudflare через браузер
wrangler login

# Створіть R2 bucket
wrangler r2 bucket create images

# Примітка: ім'я "images" використовується у конфігурації за замовчуванням
```

#### 1.3 Створення KV namespace для кешування

```bash
# Створіть KV namespace
wrangler kv:namespace create KV_CACHE

# Збережіть отриманий ID — він знадобиться у .env
# Формат: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

#### 1.4 Налаштування CORS для R2 (публічний доступ до зображень)

1. У панелі Cloudflare перейдіть до **R2** → **Manage R2 tokens**
2. Створіть токен з правами **Object Read & Write** для bucket `images`
3. Або зробіть bucket публічним через **R2** → **Settings** → **Public bucket**

> **Важливо**: Для публічного доступу до зображень увімкніть "Public bucket" у налаштуваннях R2 bucket.

---

### Крок 2: Створення Auth0 акаунту

#### 2.1 Реєстрація

1. Перейдіть на https://auth0.com та зареєструйтесь
2. Оберіть **Free Plan**
3. Створіть новий Tenant (наприклад: `mystore`)

#### 2.2 Створення SPA Application

1. У панелі Auth0 перейдіть до **Applications** → **+ Create Application**
2. Оберіть **Single Page App** → **React**
3. Заповніть:
   - **Name**: `Fufuni Store`
   - **Allowed Callback URLs**: `http://localhost:5173,https://your-domain.com`
   - **Allowed Logout URLs**: `http://localhost:5173,https://your-domain.com`
   - **Allowed Web Origins**: `http://localhost:5173,https://your-domain.com`

#### 2.3 Створення Machine-to-Machine Application (для API)

1. **Applications** → **+ Create Application**
2. Оберіть **Machine to Machine**
3. Оберіть **Auth0 Management API**
4. Надайте всі дозволи (permissions)

#### 2.4 Налаштування Social Connections (опціонально)

1. **Authentication** → **Social**
2. Увімкніть потрібні провайдери:
   - GitHub
   - Google
   - Apple
   - Windows Live

#### 2.5 Створення API

1. **Applications** → **APIs** → **+ Create API**
2. Заповніть:
   - **Name**: `Fufuni API`
   - **Identifier**: `https://api.your-store.com`
   - **Signing Algorithm**: `RS256`

#### 2.6 Налаштування Post-Login Action

Проект включає автоматичний скрипт для налаштування, але для ручного налаштування:

1. **Actions** → **Library** → **+ Create Action** → **Custom**
2. Name: `Add User Permissions`
3. Runtime: `Node.js`
4. Код:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://fufuni.dev/permissions';
  
  // Додаємо стандартні дозволи для нових користувачів
  if (event.authorization && event.authorization.permissions) {
    api.accessToken.setCustomClaim(namespace, event.authorization.permissions);
  }
};
```

5. **Deploy** → додайте до **Login** flow

---

### Крок 3: Налаштування Stripe

#### 3.1 Реєстрація

1. Перейдіть на https://dashboard.stripe.com/register
2. Підтвердіть email
3. Увімкніть тестовий режим для розробки

#### 3.2 Отримання API ключів

1. **Developers** → **API keys**
2. Скопіюйте:
   - **Publishable key** (починається з `pk_`)
   - **Secret key** (починається з `sk_`) — потрібно для сервера

#### 3.3 Налаштування Webhook

1. **Developers** → **Webhooks** → **+ Add endpoint**
2. **Endpoint URL**: `https://your-worker.workers.dev/v1/stripe/webhook`
3. **Select events** → обираємо:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
4. Скопіюйте **Webhook signing secret** (починається з `whsec_`)

#### 3.4 Тестові картки

Для тестування використовуйте:
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Any future date, any CVC, any ZIP**

---

### Крок 4: Налаштування Mailgun

#### 4.1 Реєстрація

1. Перейдіть на https://www.mailgun.com
2. Зареєструйтесь (Free tier)
3. Підтвердіть домен або використайте sandbox

#### 4.2 Налаштування SMTP

1. **Sending** → **Domain Settings**
2. Оберіть sandbox домен або додайте свій
3. Скопіюйте:
   - **API Key** (з секції "API Credentials")
   - **Default SMTP Login** (ваш email)

#### 4.3 API Base URL

- Для US: `https://api.mailgun.net/v3`
- Для EU: `https://api.eu.mailgun.net/v3`

---

### Крок 5: Клонування та налаштування репозиторію

#### 5.1 Fork та клонування

```bash
# Варіант 1: Fork через GitHub UI, потім клонування
git clone https://github.com/YOUR_USERNAME/fufuni.git
cd fufuni

# Варіант 2: Безпосереднє клонування (для читання)
git clone https://github.com/sctg-development/fufuni.git
cd fufuni
```

#### 5.2 Встановлення залежностей

```bash
# Встановіть Node.js 18+ якщо ще не встановлено
node --version  # має бути >= 18.0.0

# Встановлення всіх залежностей (monorepo)
npm install
```

#### 5.3 Створення .env файлу

```bash
# З кореневої директорії
cp apps/client/.env.example apps/client/.env

# Для розробки також створіть .env у корені (для скриптів)
touch .env
```

#### 5.4 Заповнення .env для фронтенду

Відредагуйте `apps/client/.env`:

```bash
# ============================================
# AUTH0 КОНФІГУРАЦІЯ
# ============================================
AUTHENTICATION_PROVIDER_TYPE=auth0
AUTH0_CLIENT_ID=your_auth0_spa_client_id
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://api.your-store.com
AUTH0_SCOPE=openid profile email
AUTH0_CACHE_DURATION_S=300
AUTH0_AUTOMATIC_PERMISSIONS=admin:store,auth0:admin:api

# ============================================
# API КОНФІГУРАЦІЯ
# ============================================
API_BASE_URL=http://localhost:8787
MERCHANT_PK=pk_your_public_key

# ============================================
# ДОЗВОЛИ (мають співпадати з бекендом)
# ============================================
ADMIN_AUTH0_PERMISSION=auth0:admin:api
ADMIN_STORE_PERMISSION=admin:store
DATABASE_PERMISSION=admin:database
AI_PERMISSION=ai:api
MAIL_PERMISSION=mail:api

# ============================================
# ІНФОРМАЦІЯ ПРО МАГАЗИН
# ============================================
STORE_URL=http://localhost:5173
STORE_NAME=My Awesome Store

# ============================================
# STRIPE
# ============================================
STRIPE_PUBLISHABLE_KEY=pk_test_your_key
```

#### 5.5 Заповнення .env для бекенду (в корені проекту)

Створіть або відредагуйте `.env` в корені проекту:

```bash
# ============================================
# API KEYS (будуть згенеровані автоматично)
# ============================================
MERCHANT_SK=sk_will_be_generated
MERCHANT_PK=pk_will_be_generated

# ============================================
# STRIPE
# ============================================
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret

# ============================================
# AUTH0
# ============================================
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://api.your-store.com
AUTH0_CLIENT_ID=your_m2m_client_id
AUTH0_CLIENT_SECRET=your_m2m_client_secret
AUTH0_MANAGEMENT_API_CLIENT_ID=your_mgmt_client_id
AUTH0_MANAGEMENT_API_CLIENT_SECRET=your_mgmt_client_secret
AUTH0_SCOPE=openid profile email
AUTH0_AUTOMATIC_PERMISSIONS=admin:store,auth0:admin:api

# ============================================
# MAILGUN
# ============================================
MAILGUN_API_KEY=key-your_api_key
MAILGUN_DOMAIN=your-domain.mailgun.org
MAILGUN_BASE_URL=https://api.mailgun.net/v3
MAILGUN_USER=postmaster@your-domain.mailgun.org

# ============================================
# STORE
# ============================================
STORE_URL=http://localhost:5173
STORE_NAME=My Awesome Store
IMAGES_URL=https://your-r2.workers.dev

# ============================================
# CORS & API
# ============================================
CORS_ORIGIN=http://localhost:5173
API_BASE_URL=http://localhost:8787

# ============================================
# KV CACHE
# ============================================
KV_CACHE_ID=your_kv_id
KV_CACHE_SEARCH_TTL_SECONDS=300
KV_CACHE_REVIEWS_TTL_SECONDS=600
KV_CACHE_DEFAULT_TTL_SECONDS=3600

# ============================================
# SECURITY
# ============================================
ORDER_TOKEN_SECRET=generate_a_secure_random_string
CRYPTOKEN=generate_another_secure_random_string
```

---

### Крок 6: Локальна розробка

#### 6.1 Запуск бекенду

```bash
# У першій термінальній сесії
cd apps/merchant
npm run dev
```

Сервер буде доступний за адресою: http://localhost:8787

#### 6.2 Запуск фронтенду

```bash
# У другій термінальній сесії (з кореневої директорії)
npm run dev:env
```

Фронтенд буде доступний за адресою: http://localhost:5173

#### 6.3 Автоматичний запуск обох

```bash
# З кореневої директорії
npm run dev:env
# Запустить і Worker, і Vite паралельно
```

#### 6.4 Підготовка локальної бази даних

```bash
# Відкрийте нову термінальну сесію
cd apps/merchant

# Запустіть скрипт ініціалізації (він створить ключі та схему)
npx tsx scripts/init.ts
```

Цей скрипт:
- Згенерує публічний та адмін ключі
- Створить таблиці в локальній SQLite базі
- Додасть базові дані (валюти, країни)

**Збережіть виведені ключі!** Вони показуються лише один раз.

#### 6.5 Підключення Stripe (локально)

```bash
# Встановіть Stripe CLI
# macOS
brew install stripe/stripe-cli/stripe

# Linux
curl -s https://packages.stripe.com/stripe-signing.deb | sudo dpkg -i -

# Авторизація
stripe login

# Запуск webhook forwarder
stripe listen --forward-to localhost:8787/v1/stripe/webhook
```

Скопіюйте webhook signing secret з виводу команди (починається з `whsec_`) і додайте до `.env`:

```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx
```

---

### Крок 7: Деплой на Cloudflare Workers

#### 7.1 Встановлення секретів

```bash
cd apps/merchant

# Встановіть кожен секрет
wrangler secret put STRIPE_SECRET_KEY
# Введіть: sk_test_xxxxx

wrangler secret put STRIPE_WEBHOOK_SECRET
# Введіть: whsec_xxxxx

wrangler secret put ORDER_TOKEN_SECRET
# Введіть: ваш_секретний_рядок

wrangler secret put MAILGUN_API_KEY
# Введіть: key-xxxxx

wrangler secret put AUTH0_CLIENT_SECRET
# Введіть: your_auth0_client_secret

wrangler secret put AUTH0_MANAGEMENT_API_CLIENT_SECRET
# Введіть: your_management_api_client_secret
```

#### 7.2 Оновлення wrangler.jsonc

Відредагуйте `apps/merchant/wrangler.jsonc`:

```jsonc
{
  "name": "merchant",
  "main": "src/index.ts",
  "compatibility_date": "2025-01-01",

  "durable_objects": {
    "bindings": [
      { "name": "MERCHANT", "class_name": "MerchantDO" }
    ]
  },

  "migrations": [
    { "tag": "v1", "new_sqlite_classes": ["MerchantDO"] }
  ],

  "r2_buckets": [
    { "binding": "IMAGES" }  // Ваш R2 bucket
  ],

  "kv_namespaces": [
    { "binding": "KV_CACHE", "id": "YOUR_KV_NAMESPACE_ID" }
  ],

  "vars": {
    // Не чутливі змінні
    "MERCHANT_PK": "pk_your_key",
    "AUTH0_DOMAIN": "your-tenant.auth0.com",
    "AUTH0_AUDIENCE": "https://api.your-store.com",
    "AUTH0_CLIENT_ID": "your_client_id",
    "AUTH0_MANAGEMENT_API_CLIENT_ID": "your_mgmt_client_id",
    "STORE_URL": "https://your-username.github.io/your-repo",
    "STORE_NAME": "My Store",
    "IMAGES_URL": "https://your-r2.workers.dev",
    "CORS_ORIGIN": "https://your-username.github.io",
    "API_BASE_URL": "https://merchant.your-account.workers.dev",
    "KV_CACHE_ID": "your_kv_id"
  },

  "triggers": {
    "crons": ["*/15 * * * *"]
  }
}
```

#### 7.3 Деплой

```bash
cd apps/merchant

# Деплой Worker
wrangler deploy
```

Після успішного деплою ви отримаєте URL типу:
`https://merchant.aaaa0000.workers.dev`

#### 7.4 Налаштування Stripe Webhook для продакшену

1. У Stripe Dashboard перейдіть до **Webhooks**
2. Змініть endpoint URL на ваш продакшен-URL:
   `https://merchant.your-account.workers.dev/v1/stripe/webhook`

#### 7.5 Ініціалізація продакшен-бази

```bash
cd apps/merchant

# Встановіть remote URL
export API_BASE_URL=https://merchant.your-account.workers.dev

# Запустіть ініціалізацію
npx tsx scripts/init.ts --remote
```

---

### Крок 8: Деплой фронтенду на GitHub Pages

#### 8.1 Увімкнення GitHub Pages

1. На GitHub перейдіть до вашого репозиторію
2. **Settings** → **Pages**
3. **Source**: GitHub Actions

#### 8.2 Налаштування GitHub Secrets

У репозиторії перейдіть до **Settings** → **Secrets and variables** → **Actions** та додайте:

| Secret Name | Value |
|-------------|-------|
| `AUTH0_CLIENT_ID` | Ваш Auth0 SPA Client ID |
| `AUTH0_CLIENT_SECRET` | Ваш Auth0 Client Secret |
| `AUTH0_DOMAIN` | your-tenant.auth0.com |
| `AUTH0_MANAGEMENT_API_CLIENT_ID` | Auth0 Management API Client ID |
| `AUTH0_MANAGEMENT_API_CLIENT_SECRET` | Auth0 Management API Client Secret |
| `AUTH0_AUDIENCE` | https://api.your-store.com |
| `MERCHANT_PK` | Публічний ключ (pk_xxx) |
| `API_BASE_URL` | https://merchant.your-account.workers.dev |
| `STORE_URL` | https://your-username.github.io/your-repo |
| `STORE_NAME` | My Store |
| `STRIPE_PUBLISHABLE_KEY` | pk_test_xxx |
| `CORS_ORIGIN` | https://your-username.github.io |

#### 8.3 Перший деплой

```bash
git add .
git commit -m "Configure environment variables"
git push origin main
```

GitHub Actions автоматично:
1. Створить зашифрований .env artifact
2. Збудує фронтенд
3. Деплой на GitHub Pages

#### 8.4 Налаштування Auth0 Callback URLs

Після першого деплою додайте production URL до Auth0:
- **Allowed Callback URLs**: `https://your-username.github.io/your-repo,https://your-username.github.io`
- **Allowed Logout URLs**: `https://your-username.github.io/your-repo,https://your-username.github.io`
- **Allowed Web Origins**: `https://your-username.github.io`

---

## Ініціалізація магазину

### Підключення Stripe до продакшену

```bash
curl -X POST https://merchant.your-account.workers.dev/v1/setup/stripe \
  -H "Authorization: Bearer sk_your_admin_key" \
  -H "Content-Type: application/json" \
  -d '{
    "stripe_secret_key": "sk_live_xxx",
    "stripe_webhook_secret": "whsec_xxx"
  }'
```

### Перевірка статусу

```bash
curl https://merchant.your-account.workers.dev/v1/setup/status \
  -H "Authorization: Bearer sk_your_admin_key"
```

---

## Тестування

### Тест каталогу

```bash
# Отримати список товарів
curl https://merchant.your-account.workers.dev/v1/products \
  -H "Authorization: Bearer pk_your_public_key"

# Пошук товарів
curl "https://merchant.your-account.workers.dev/v1/products/search?q=shirt" \
  -H "Authorization: Bearer pk_your_public_key"
```

### Тест оформлення замовлення

1. Відкрийте фронтенд у браузері
2. Додайте товар до кошика
3. Перейдіть до оформлення
4. Використайте тестову картку Stripe: `4242 4242 4242 4242`

### Перевірка email

Перевірте inbox на email, вказаному при оформленні замовлення. Має прийти email з підтвердженням.

---

## Демо-дані

Для швидкого старту можна заповнити магазин демо-даними:

```bash
cd apps/merchant
npx tsx scripts/seed.ts https://merchant.your-account.workers.dev sk_your_admin_key
```

Це створить:
- 12+ категорій товарів
- 20+ товарів з варіантами
- Зразкові замовлення
- Shipping rates
- Tax rates
- Email шаблони

---

## GitHub Secrets

### Повний список secrets для репозиторію

```yaml
# Auth0
AUTH0_CLIENT_ID: "your_spa_client_id"
AUTH0_CLIENT_SECRET: "your_spa_client_secret"
AUTH0_DOMAIN: "your-tenant.auth0.com"
AUTH0_MANAGEMENT_API_CLIENT_ID: "your_mgmt_client_id"
AUTH0_MANAGEMENT_API_CLIENT_SECRET: "your_mgmt_client_secret"
AUTH0_AUDIENCE: "https://api.your-store.com"

# API Keys
MERCHANT_PK: "pk_live_xxx"

# Store
API_BASE_URL: "https://merchant.your-account.workers.dev"
STORE_URL: "https://your-username.github.io/repo-name"
STORE_NAME: "My Awesome Store"
CORS_ORIGIN: "https://your-username.github.io"

# Stripe
STRIPE_PUBLISHABLE_KEY: "pk_live_xxx"
```

---

## FAQ та Troubleshooting

### Q: Worker не деплоїться

**A:** Перевірте:
1. `wrangler login` виконано
2. `wrangler.jsonc` валідний JSONC
3. KV namespace ID правильний
4. R2 bucket існує

```bash
# Перевірка KV
wrangler kv:namespace list

# Перевірка R2
wrangler r2 bucket list
```

### Q: Помилка авторизації Auth0

**A:** Перевірте:
1. Callback URLs включають ваш домен
2. Client ID та Secret правильні
3. Audience відповідає налаштуванням API в Auth0

### Q: Stripe webhook не працює

**A:** Перевірте:
1. Endpoint URL правильний
2. Webhook secret встановлено через `wrangler secret put`
3. Вибрані правильні events

```bash
# Тест webhook locally
stripe listen --forward-to localhost:8787/v1/stripe/webhook

# Перевірка логів на продакшені
wrangler tail
```

### Q: Зображення не завантажуються

**A:** Перевірте:
1. R2 bucket публічний
2. IMAGES_URL правильний
3. CORS налаштовано на R2

### Q: Free tier ліміти

**A:** Пам'ятайте про ліміти:
- Workers: 100,000 запитів/день
- Durable Objects: 100,000 запитів/день
- D1 reads: 5M рядків/день
- R2: 10GB storage
- KV: 1GB storage

При перевищенні лімітів Cloudflare поверне помилку 429.

---

## Корисні ресурси

- **Демо**: https://sctg-development.github.io/fufuni/
- **Документація Fufuni**: https://github.com/sctg-development/fufuni
- **Cloudflare Docs**: https://developers.cloudflare.com
- **Auth0 Docs**: https://auth0.com/docs
- **Stripe Docs**: https://stripe.com/docs
- **Mailgun Docs**: https://documentation.mailgun.com

---

## Наступні кроки

1. **Кастомізація**: Змініть `STORE_NAME`, логотип, кольори в темі
2. **Товари**: Додайте свої товари через адмін-панель
3. **Домен**: Підключіть власний домен до GitHub Pages та Cloudflare Workers
4. **SEO**: Налаштуйте Meta tags, sitemap
5. **Analytics**: Підключіть Google Analytics або Plausible

---

*Посібник оновлено: квітень 2026*  
*Сумісність: Fufuni v1.x, Cloudflare Workers, Node.js 18+*
