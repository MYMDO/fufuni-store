/**
 * Seed script - populates the store with demo data
 */

const API_URL = process.env.API_BASE_URL || 'http://localhost:8787';
const ADMIN_KEY = process.env.MERCHANT_SK || '';

async function api(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(ADMIN_KEY ? { 'Authorization': `Bearer ${ADMIN_KEY}` } : {})
  };

  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(`${endpoint}: ${error.error}`);
  }

  return response.json();
}

function generateId() {
  return crypto.randomUUID();
}

async function seed() {
  console.log('🌱 Seeding demo data...\n');

  // Create categories
  console.log('Creating categories...');
  const categories = await Promise.all([
    api('/v1/categories', {
      method: 'POST',
      body: JSON.stringify({ name: 'Одяг', slug: 'clothing' })
    }),
    api('/v1/categories', {
      method: 'POST',
      body: JSON.stringify({ name: 'Аксесуари', slug: 'accessories' })
    }),
    api('/v1/categories', {
      method: 'POST',
      body: JSON.stringify({ name: 'Для дому', slug: 'home' })
    }),
    api('/v1/categories', {
      method: 'POST',
      body: JSON.stringify({ name: 'Електроніка', slug: 'electronics' })
    })
  ]);
  console.log(`Created ${categories.length} categories\n`);

  // Create products
  console.log('Creating products...');
  const products = [
    {
      title: 'Футболка базова',
      description: 'Базова біла футболка з високоякісної бавовни',
      price: 29900,
      categoryId: categories[0].id,
      variants: [
        { sku: 'TS-WHT-S', title: 'Біла / S', stock: 10 },
        { sku: 'TS-WHT-M', title: 'Біла / M', stock: 15 },
        { sku: 'TS-WHT-L', title: 'Біла / L', stock: 12 },
        { sku: 'TS-BLK-S', title: 'Чорна / S', stock: 8 },
        { sku: 'TS-BLK-M', title: 'Чорна / M', stock: 20 }
      ]
    },
    {
      title: 'Худі з капюшоном',
      description: 'Тепле худі для прохолодних днів',
      price: 79900,
      categoryId: categories[0].id,
      variants: [
        { sku: 'HD-GRY-M', title: 'Сіра / M', stock: 5 },
        { sku: 'HD-GRY-L', title: 'Сіра / L', stock: 7 },
        { sku: 'HD-BLK-L', title: 'Чорна / L', stock: 10 }
      ]
    },
    {
      title: 'Еко-торба',
      description: 'Міцна торба з екологічного матеріалу',
      price: 14900,
      categoryId: categories[1].id,
      variants: [
        { sku: 'BG-ECO-01', title: 'Стандарт', stock: 50 }
      ]
    },
    {
      title: 'Кружка керамічна',
      description: 'Кружка 300мл для кави та чаю',
      price: 19900,
      categoryId: categories[2].id,
      variants: [
        { sku: 'MG-WHT-01', title: 'Біла', stock: 30 },
        { sku: 'MG-BLU-01', title: 'Синя', stock: 25 }
      ]
    },
    {
      title: 'Блокнот А5',
      description: 'Блокнот у твердій обкладинці, 120 аркушів',
      price: 9900,
      categoryId: categories[1].id,
      variants: [
        { sku: 'NB-A5-01', title: 'Універсальний', stock: 40 }
      ]
    },
    {
      title: 'Чохол для телефону',
      description: 'Силіконовий чохол з захисними властивостями',
      price: 19900,
      categoryId: categories[3].id,
      variants: [
        { sku: 'CS-IPH-BLK', title: 'iPhone / Чорний', stock: 15 },
        { sku: 'CS-IPH-CLR', title: 'iPhone / Прозорий', stock: 20 },
        { sku: 'CS-AND-BLK', title: 'Android / Чорний', stock: 12 }
      ]
    },
    {
      title: 'Навушники бездротові',
      description: 'Bluetooth навушники з шумопоглинанням',
      price: 129900,
      categoryId: categories[3].id,
      variants: [
        { sku: 'HP-BT-BLK', title: 'Чорні', stock: 8 },
        { sku: 'HP-BT-WHT', title: 'Білі', stock: 6 }
      ]
    },
    {
      title: 'Шапка зимова',
      description: 'Тепла вовняна шапка ручної роботи',
      price: 44900,
      categoryId: categories[0].id,
      variants: [
        { sku: 'HT-WOL-ONE', title: 'One Size', stock: 20 }
      ]
    }
  ];

  for (const productData of products) {
    try {
      const product = await api('/v1/products', {
        method: 'POST',
        body: JSON.stringify({
          title: productData.title,
          description: productData.description,
          price: productData.price,
          categoryId: productData.categoryId
        })
      });

      // Update to active status
      await api(`/v1/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'active' })
      });

      // Create variants
      for (const variant of productData.variants) {
        await api(`/v1/products/${product.id}/variants`, {
          method: 'POST',
          body: JSON.stringify({
            sku: variant.sku,
            title: variant.title,
            price: productData.price,
            stock: variant.stock
          })
        });
      }

      console.log(`  ✓ ${productData.title}`);
    } catch (e) {
      console.log(`  ✗ ${productData.title}: ${e.message}`);
    }
  }

  // Create a discount code
  console.log('\nCreating discount code...');
  try {
    await api('/v1/admin/discounts', {
      method: 'POST',
      body: JSON.stringify({
        code: 'WELCOME10',
        type: 'percentage',
        value: 10,
        maxUses: 100
      })
    });
    console.log('  ✓ Created WELCOME10 (10% off)\n');
  } catch (e) {
    console.log(`  ✗ Discount: ${e.message}\n`);
  }

  console.log('✅ Seeding complete!');
  console.log('\nStore is ready at:', API_URL);
}

seed().catch(console.error);
