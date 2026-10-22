const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const products = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'products.json'), 'utf8')
);

const storePath = path.join(__dirname, 'data', 'store.json');

function readStore() {
  if (!fs.existsSync(storePath)) {
    return { newsletter: [], orders: [] };
  }
  return JSON.parse(fs.readFileSync(storePath, 'utf8'));
}

function writeStore(store) {
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
}

const COUPONS = {
  VC25: { discount: 300, label: 'APP PROMO (VC25)' },
};

const EXPRESS_PIN_PREFIXES = ['400', '401', '110', '122', '201', '560', '561', '562'];

function filterProducts(query) {
  let list = [...products];
  const { category, size, fit, sort, q } = query;

  if (category && category !== 'all') {
    list = list.filter((p) => p.category === category);
  }
  if (fit && fit !== 'ALL') {
    list = list.filter((p) => p.fit === fit);
  }
  if (size && size !== 'ALL') {
    list = list.filter(
      (p) => p.sizes.includes(size) || p.sizes.includes('ONE SIZE')
    );
  }
  if (q && String(q).trim()) {
    const term = String(q).toLowerCase();
    list = list.filter(
      (p) =>
        p.title.toLowerCase().includes(term) ||
        p.subtitle.toLowerCase().includes(term) ||
        p.fit.toLowerCase().includes(term)
    );
  }

  const sortBy = sort || 'trending';
  if (sortBy === 'price-low') list.sort((a, b) => a.price - b.price);
  else if (sortBy === 'price-high') list.sort((a, b) => b.price - a.price);
  else if (sortBy === 'discount') {
    list.sort(
      (a, b) => parseInt(b.discount, 10) - parseInt(a.discount, 10)
    );
  } else if (sortBy === 'rating') list.sort((a, b) => b.rating - a.rating);

  return list;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'velvetclap25' });
});

app.get('/api/products', (req, res) => {
  res.json({ products: filterProducts(req.query), total: products.length });
});

app.get('/api/products/:id', (req, res) => {
  const product = products.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

app.post('/api/delivery/check', (req, res) => {
  const pin = String(req.body.pincode || '').trim();
  if (!/^\d{6}$/.test(pin)) {
    return res.status(400).json({
      valid: false,
      message: 'PLEASE ENTER A VALID 6-DIGIT INDIAN PINCODE.',
    });
  }
  const prefix = pin.slice(0, 3);
  const expressAvailable = EXPRESS_PIN_PREFIXES.includes(prefix);
  res.json({
    valid: true,
    pincode: pin,
    expressAvailable,
    message: expressAvailable
      ? `PINCODE ${pin} VERIFIED! EXPRESS 48H AIR COURIER AVAILABLE. ORDER BEFORE 4:00 PM FOR SAME-DAY DISPATCH.`
      : `PINCODE ${pin} VERIFIED! STANDARD 3–5 DAY PAN-INDIA DELIVERY. FREE SHIPPING ON ORDERS OVER ₹999.`,
  });
});

app.post('/api/coupons/validate', (req, res) => {
  const code = String(req.body.code || '')
    .trim()
    .toUpperCase();
  const coupon = COUPONS[code];
  if (!coupon) {
    return res.status(400).json({
      valid: false,
      message: 'INVALID VOUCHER CODE. USE "VC25"',
    });
  }
  res.json({
    valid: true,
    code,
    discount: coupon.discount,
    label: coupon.label,
    message: `CODE ${code} APPLIED: FLAT ₹${coupon.discount} OFF ACTIVATED!`,
  });
});

app.post('/api/newsletter', (req, res) => {
  const email = String(req.body.email || '')
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, message: 'Invalid email address.' });
  }
  const store = readStore();
  if (store.newsletter.includes(email)) {
    return res.json({
      ok: true,
      message: "You're already on the vault list — welcome back!",
    });
  }
  store.newsletter.push(email);
  writeStore(store);
  res.json({
    ok: true,
    message: `Vault pass issued to ${email}! Check inbox for 15% code.`,
  });
});

app.post('/api/orders', (req, res) => {
  const { items, couponCode, customer } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  let subtotal = 0;
  const lineItems = [];

  for (const row of items) {
    const product = products.find((p) => p.id === row.productId);
    if (!product) {
      return res.status(400).json({ error: `Unknown product: ${row.productId}` });
    }
    const qty = Math.max(1, Math.min(10, Number(row.quantity) || 1));
    const size = row.size || product.sizes[0];
    if (!product.sizes.includes(size) && !product.sizes.includes('ONE SIZE')) {
      return res.status(400).json({ error: `Invalid size ${size} for ${product.id}` });
    }
    if (product.stockLeft < qty) {
      return res.status(400).json({
        error: `Only ${product.stockLeft} left for ${product.title}`,
      });
    }
    subtotal += product.price * qty;
    lineItems.push({
      productId: product.id,
      title: product.title,
      size,
      colorIndex: row.colorIndex ?? 0,
      quantity: qty,
      unitPrice: product.price,
    });
  }

  let discount = 0;
  const code = String(couponCode || '')
    .trim()
    .toUpperCase();
  if (code && COUPONS[code]) discount = COUPONS[code].discount;

  const total = Math.max(0, subtotal - discount);
  const orderRef = `VC25-${Date.now().toString(36).toUpperCase()}`;

  const store = readStore();
  store.orders.push({
    orderRef,
    items: lineItems,
    customer: customer || null,
    subtotal,
    discount,
    total,
    status: 'pending_payment',
    createdAt: new Date().toISOString(),
  });
  writeStore(store);

  res.status(201).json({
    orderRef,
    subtotal,
    discount,
    total,
    shipping: subtotal >= 999 ? 'FREE' : '₹99',
    paymentMethods: ['UPI (GPay/PhonePe/Paytm)', 'NetBanking', 'Cash on Delivery'],
    message:
      'Order recorded. Connect Razorpay keys in production for live UPI/card checkout.',
  });
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`VELVETCLAP25 running at http://localhost:${PORT}`);
});
