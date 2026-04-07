import { html, render } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';

// Configuration - Update these values
const CONFIG = {
  API_URL: 'https://fufuni-api.p4d-b2q.workers.dev',
  PUBLIC_KEY: '',
  STORE_NAME: 'Fufuni Store'
};

// State
let state = {
  cart: { items: [], subtotal: 0 },
  cartId: localStorage.getItem('cartId'),
  products: [],
  categories: [],
  currentPage: 'home',
  adminTab: 'products',
  loading: false,
  toast: null
};

// API helper
async function api(endpoint, options = {}) {
  const url = `${CONFIG.API_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(CONFIG.PUBLIC_KEY ? { 'Authorization': `Bearer ${CONFIG.PUBLIC_KEY}` } : {})
  };

  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// Cart functions
async function loadCart() {
  if (!state.cartId) {
    const cart = await api('/v1/cart', { method: 'POST' });
    state.cartId = cart.id;
    localStorage.setItem('cartId', cart.id);
    state.cart = cart;
  } else {
    try {
      state.cart = await api(`/v1/cart/${state.cartId}`);
    } catch {
      const cart = await api('/v1/cart', { method: 'POST' });
      state.cartId = cart.id;
      localStorage.setItem('cartId', cart.id);
      state.cart = cart;
    }
  }
  updateUI();
}

async function addToCart(productId, variantId, quantity = 1) {
  try {
    state.cart = await api(`/v1/cart/${state.cartId}/items`, {
      method: 'POST',
      body: JSON.stringify({ productId, variantId, quantity })
    });
    showToast('Товар додано до кошика', 'success');
    updateUI();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function updateCartItem(itemId, quantity) {
  state.cart = await api(`/v1/cart/${state.cartId}/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify({ quantity })
  });
  updateUI();
}

async function removeFromCart(itemId) {
  state.cart = await api(`/v1/cart/${state.cartId}/items/${itemId}`, {
    method: 'DELETE'
  });
  updateUI();
}

function clearCart() {
  state.cart = { items: [], subtotal: 0 };
  localStorage.removeItem('cartId');
  state.cartId = null;
  updateUI();
}

// Toast notification
function showToast(message, type = 'info') {
  state.toast = { message, type };
  updateUI();
  setTimeout(() => {
    state.toast = null;
    updateUI();
  }, 3000);
}

// Navigation
function navigate(page) {
  state.currentPage = page;
  updateUI();
  window.scrollTo(0, 0);
}

function navigateAdmin(tab) {
  state.adminTab = tab;
  updateUI();
}

// Format currency
function formatPrice(cents) {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH'
  }).format(cents / 100);
}

// Header component
function Header() {
  const cartCount = state.cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return html`
    <header>
      <div class="header-content">
        <a href="#" class="logo" onclick=${() => navigate('home')}>
          🛍️ ${CONFIG.STORE_NAME}
        </a>
        <nav>
          <a href="#" onclick=${() => navigate('home')}>Каталог</a>
          <a href="#" onclick=${() => navigate('admin')}>Адмін</a>
          <button class="cart-btn" onclick=${() => toggleCart(true)}>
            🛒
            ${cartCount > 0 && html`<span class="cart-count">${cartCount}</span>`}
          </button>
        </nav>
      </div>
    </header>
  `;
}

// Hero section
function Hero() {
  return html`
    <section class="hero">
      <h1>Вітаємо у ${CONFIG.STORE_NAME}!</h1>
      <p>Сучасний serverless інтернет-магазин на Cloudflare Workers. Швидко, надійно, безкоштовно.</p>
      <button class="primary" onclick=${() => navigate('home')}>
        Переглянути каталог
      </button>
    </section>
  `;
}

// Product card
function ProductCard({ product }) {
  const variant = product.variants?.[0] || { price: product.price };
  const image = product.images?.[0] || '📦';

  const handleAddToCart = () => {
    if (variant.id) {
      addToCart(product.id, variant.id);
    } else {
      showToast('Цей товар тимчасово недоступний', 'error');
    }
  };

  return html`
    <div class="product-card">
      <div class="product-image">${image}</div>
      <div class="product-info">
        <div class="product-title">${product.title}</div>
        <div class="product-price">${formatPrice(variant.price)}</div>
        <div class="product-actions">
          <button class="primary" onclick=${handleAddToCart}>
            В кошик
          </button>
        </div>
      </div>
    </div>
  `;
}

// Products grid
function ProductsGrid() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/v1/products?status=active&limit=50')
      .then(data => setProducts(data.products || []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  return html`
    <section class="products-section">
      <div class="section-header">
        <h2 class="section-title">Каталог товарів</h2>
      </div>
      ${loading ? html`
        <div class="loading"><div class="spinner"></div></div>
      ` : products.length === 0 ? html`
        <div class="cart-empty">
          <p>Товарів поки що немає.</p>
          <p style="margin-top: 1rem;">
            <a href="#" onclick=${() => navigate('admin')}>Додайте товари в адмін-панелі</a>
          </p>
        </div>
      ` : html`
        <div class="products-grid">
          ${products.map(product => html`<${ProductCard} key=${product.id} product=${product} />`)}
        </div>
      `}
    </section>
  `;
}

// Cart drawer
let cartOpen = false;

function toggleCart(open) {
  cartOpen = open;
  updateUI();
}

function CartDrawer() {
  const { cart } = state;

  return html`
    <div class="cart-overlay ${cartOpen ? 'open' : ''}" onclick=${() => toggleCart(false)}></div>
    <div class="cart-drawer ${cartOpen ? 'open' : ''}">
      <div class="cart-header">
        <h2>🛒 Кошик</h2>
        <button class="close-btn" onclick=${() => toggleCart(false)}>×</button>
      </div>
      <div class="cart-items">
        ${cart.items.length === 0 ? html`
          <div class="cart-empty">
            <p>Кошик порожній</p>
            <button class="secondary" onclick=${() => { toggleCart(false); navigate('home'); }}>
              До каталогу
            </button>
          </div>
        ` : cart.items.map(item => html`
          <div class="cart-item">
            <div class="cart-item-image">${item.image || '📦'}</div>
            <div class="cart-item-info">
              <div class="cart-item-title">${item.title}</div>
              <div class="cart-item-price">${formatPrice(item.price)}</div>
              <div class="cart-item-qty">
                <button onclick=${() => updateCartItem(item.id, item.quantity - 1)}>−</button>
                <span>${item.quantity}</span>
                <button onclick=${() => updateCartItem(item.id, item.quantity + 1)}>+</button>
              </div>
            </div>
            <button class="secondary" onclick=${() => removeFromCart(item.id)}>×</button>
          </div>
        `)}
      </div>
      ${cart.items.length > 0 && html`
        <div class="cart-footer">
          <div class="cart-subtotal">
            <span>Разом:</span>
            <span>${formatPrice(cart.subtotal)}</span>
          </div>
          <button class="primary" onclick=${() => { toggleCart(false); navigate('checkout'); }}>
            Оформити замовлення
          </button>
        </div>
      `}
    </div>
  `;
}

// Checkout page
function CheckoutPage() {
  const [form, setForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    city: '',
    postalCode: '',
    address: '',
    country: 'UA'
  });
  const [submitting, setSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const result = await api('/v1/checkout', {
        method: 'POST',
        body: JSON.stringify({
          cartId: state.cartId,
          customer: {
            email: form.email,
            firstName: form.firstName,
            lastName: form.lastName,
            phone: form.phone
          },
          shippingAddress: {
            line1: form.address,
            city: form.city,
            postalCode: form.postalCode,
            country: form.country
          }
        })
      });

      setOrderResult(result);
      clearCart();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (orderResult) {
    return html`
      <div class="checkout-page">
        <div class="form-section" style="text-align: center; padding: 3rem;">
          <h2 style="font-size: 2rem; margin-bottom: 1rem;">✅ Замовлення оформлено!</h2>
          <p style="margin-bottom: 1rem;">Номер замовлення: <strong>${orderResult.order.number}</strong></p>
          <p style="margin-bottom: 2rem;">На вашу пошту надіслано підтвердження.</p>
          <button class="primary" onclick=${() => navigate('home')}>
            Повернутися до каталогу
          </button>
        </div>
      </div>
    `;
  }

  return html`
    <div class="checkout-page">
      <h1 style="margin-bottom: 2rem;">Оформлення замовлення</h1>
      <form class="checkout-form" onsubmit=${handleSubmit}>
        <div class="form-section">
          <h3>👤 Контактні дані</h3>
          <div class="form-group">
            <label>Email *</label>
            <input type="email" required value=${form.email}
              oninput=${e => setForm({...form, email: e.target.value})} />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Ім'я</label>
              <input value=${form.firstName}
                oninput=${e => setForm({...form, firstName: e.target.value})} />
            </div>
            <div class="form-group">
              <label>Прізвище</label>
              <input value=${form.lastName}
                oninput=${e => setForm({...form, lastName: e.target.value})} />
            </div>
          </div>
          <div class="form-group">
            <label>Телефон</label>
            <input type="tel" value=${form.phone}
              oninput=${e => setForm({...form, phone: e.target.value})} />
          </div>
        </div>

        <div class="form-section">
          <h3>📍 Адреса доставки</h3>
          <div class="form-group">
            <label>Країна</label>
            <select value=${form.country} onchange=${e => setForm({...form, country: e.target.value})}>
              <option value="UA">Україна</option>
              <option value="PL">Польща</option>
              <option value="DE">Німеччина</option>
            </select>
          </div>
          <div class="form-group">
            <label>Місто *</label>
            <input required value=${form.city}
              oninput=${e => setForm({...form, city: e.target.value})} />
          </div>
          <div class="form-group">
            <label>Адреса *</label>
            <input required value=${form.address}
              oninput=${e => setForm({...form, address: e.target.value})}
              placeholder="Вулиця, будинок, квартира" />
          </div>
          <div class="form-group">
            <label>Поштовий індекс</label>
            <input value=${form.postalCode}
              oninput=${e => setForm({...form, postalCode: e.target.value})} />
          </div>
        </div>

        <div class="form-section">
          <h3>💳 Оплата</h3>
          <p style="color: var(--text-light);">
            У демо-режимі оплата не потрібна. В продакшені тут буде Stripe Checkout.
          </p>
        </div>

        <button type="submit" class="primary" disabled=${submitting} style="width: 100%;">
          ${submitting ? 'Обробка...' : 'Підтвердити замовлення'}
        </button>
      </form>
    </div>
  `;
}

// Admin panel
function AdminPanel() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [productForm, setProductForm] = useState({ title: '', price: '' });

  useEffect(() => {
    loadAdminData();
  }, [state.adminTab]);

  async function loadAdminData() {
    setLoading(true);
    try {
      if (state.adminTab === 'products') {
        const data = await api('/v1/products?limit=100');
        setProducts(data.products || []);
      } else if (state.adminTab === 'orders') {
        const data = await api('/v1/admin/orders?limit=50');
        setOrders(data.orders || []);
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
    setLoading(false);
  }

  async function createProduct(e) {
    e.preventDefault();
    try {
      await api('/v1/products', {
        method: 'POST',
        body: JSON.stringify({
          title: productForm.title,
          price: parseInt(productForm.price) * 100
        })
      });
      setShowProductForm(false);
      setProductForm({ title: '', price: '' });
      loadAdminData();
      showToast('Товар створено!', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async function deleteProduct(id) {
    if (!confirm('Видалити цей товар?')) return;
    try {
      await api(`/v1/products/${id}`, { method: 'DELETE' });
      loadAdminData();
      showToast('Товар видалено', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  return html`
    <div class="admin-layout">
      <aside class="admin-sidebar">
        <nav class="admin-nav">
          <a href="#" class=${state.adminTab === 'products' ? 'active' : ''}
            onclick=${() => navigateAdmin('products')}>
            📦 Товари
          </a>
          <a href="#" class=${state.adminTab === 'orders' ? 'active' : ''}
            onclick=${() => navigateAdmin('orders')}>
            📋 Замовлення
          </a>
          <a href="#" onclick=${() => navigate('home')}>
            ← Повернутися до магазину
          </a>
        </nav>
      </aside>
      <main class="admin-content">
        ${state.adminTab === 'products' && html`
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <h1>Товари</h1>
            <button class="primary" onclick=${() => setShowProductForm(true)}>
              + Додати товар
            </button>
          </div>
          
          ${showProductForm && html`
            <div class="form-section" style="margin-bottom: 2rem;">
              <h3>Новий товар</h3>
              <form onsubmit=${createProduct}>
                <div class="form-row">
                  <div class="form-group">
                    <label>Назва *</label>
                    <input required value=${productForm.title}
                      oninput=${e => setProductForm({...productForm, title: e.target.value})}
                      placeholder="Назва товару" />
                  </div>
                  <div class="form-group">
                    <label>Ціна (грн) *</label>
                    <input type="number" required value=${productForm.price}
                      oninput=${e => setProductForm({...productForm, price: e.target.value})}
                      placeholder="100" />
                  </div>
                </div>
                <div style="display: flex; gap: 1rem;">
                  <button type="submit" class="primary">Зберегти</button>
                  <button type="button" class="secondary" onclick=${() => setShowProductForm(false)}>
                    Скасувати
                  </button>
                </div>
              </form>
            </div>
          `}
          
          ${loading ? html`<div class="loading"><div class="spinner"></div></div>` : html`
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Назва</th>
                  <th>Ціна</th>
                  <th>Статус</th>
                  <th>Дії</th>
                </tr>
              </thead>
              <tbody>
                ${products.map(p => html`
                  <tr>
                    <td>${p.title}</td>
                    <td>${formatPrice(p.price)}</td>
                    <td>
                      <span class="status-badge badge-${p.status}">${p.status}</span>
                    </td>
                    <td>
                      <button class="secondary" onclick=${() => deleteProduct(p.id)}>
                        Видалити
                      </button>
                    </td>
                  </tr>
                `)}
                ${products.length === 0 && html`
                  <tr>
                    <td colspan="4" style="text-align: center; color: var(--text-light);">
                      Товарів поки що немає
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          `}
        `}
        
        ${state.adminTab === 'orders' && html`
          <h1 style="margin-bottom: 2rem;">Замовлення</h1>
          ${loading ? html`<div class="loading"><div class="spinner"></div></div>` : html`
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Номер</th>
                  <th>Клієнт</th>
                  <th>Сума</th>
                  <th>Статус</th>
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                ${orders.map(o => html`
                  <tr>
                    <td>${o.number}</td>
                    <td>${o.customer?.email || '—'}</td>
                    <td>${formatPrice(o.total)}</td>
                    <td>
                      <span class="status-badge status-${o.status}">${o.status}</span>
                    </td>
                    <td>${new Date(o.createdAt).toLocaleDateString('uk-UA')}</td>
                  </tr>
                `)}
                ${orders.length === 0 && html`
                  <tr>
                    <td colspan="5" style="text-align: center; color: var(--text-light);">
                      Замовлень поки що немає
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          `}
        `}
      </main>
    </div>
  `;
}

// Toast notification
function Toast() {
  if (!state.toast) return null;
  return html`
    <div class="toast ${state.toast.type}">
      ${state.toast.message}
    </div>
  `;
}

// Main App
function App() {
  useEffect(() => {
    loadCart();
  }, []);

  let content;
  switch (state.currentPage) {
    case 'home':
      content = html`
        <${Hero} />
        <${ProductsGrid} />
      `;
      break;
    case 'checkout':
      content = html`<${CheckoutPage} />`;
      break;
    case 'admin':
      content = html`<${AdminPanel} />`;
      break;
    default:
      content = html`<${Hero} />`;
  }

  return html`
    <${Header} />
    ${content}
    <${CartDrawer} />
    <${Toast} />
  `;
}

// Update UI
function updateUI() {
  render(html`<${App} />`, document.getElementById('app'));
}

// Start
updateUI();
