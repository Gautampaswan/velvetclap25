const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const app = express();

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const razorpayEnabled = Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);

let razorpayClient = null;
if (razorpayEnabled) {
  // eslint-disable-next-line global-require
  const Razorpay = require('razorpay');
  razorpayClient = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });
}

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

function findOrder(store, orderRef) {
  return store.orders.find((o) => o.orderRef === orderRef);
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

function buildOrderPayload(body) {
  const { items, couponCode, customer, paymentMethod } = body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return { error: 'Cart is empty', status: 400 };
  }

  let subtotal = 0;
  const lineItems = [];

  for (const row of items) {
    const product = products.find((p) => p.id === row.productId);
    if (!product) {
      return { error: `Unknown product: ${row.productId}`, status: 400 };
    }
    const qty = Math.max(1, Math.min(10, Number(row.quantity) || 1));
    const size = row.size || product.sizes[0];
    if (!product.sizes.includes(size) && !product.sizes.includes('ONE SIZE')) {
      return { error: `Invalid size ${size} for ${product.id}`, status: 400 };
    }
    if (product.stockLeft < qty) {
      return {
        error: `Only ${product.stockLeft} left for ${product.title}`,
        status: 400,
      };
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

  const shippingFee = subtotal >= 999 ? 0 : 99;
  const total = Math.max(0, subtotal - discount + shippingFee);
  const orderRef = `VC25-${Date.now().toString(36).toUpperCase()}`;
  const method = paymentMethod === 'cod' ? 'cod' : 'online';

  return {
    orderRef,
    lineItems,
    customer: customer || null,
    subtotal,
    discount,
    shippingFee,
    total,
    paymentMethod: method,
    couponCode: code || null,
  };
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'velvetclap25',
    payments: { razorpayEnabled },
  });
});

app.get('/api/payments/config', (_req, res) => {
  res.json({
    razorpayEnabled,
    keyId: razorpayEnabled ? RAZORPAY_KEY_ID : null,
    currency: 'INR',
    brand: 'VELVETCLAP25',
  });
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

app.post('/api/orders', async (req, res) => {
  const built = buildOrderPayload(req.body);
  if (built.error) {
    return res.status(built.status).json({ error: built.error });
  }

  const {
    orderRef,
    lineItems,
    customer,
    subtotal,
    discount,
    shippingFee,
    total,
    paymentMethod,
    couponCode,
  } = built;

  const store = readStore();
  const orderRecord = {
    orderRef,
    items: lineItems,
    customer,
    subtotal,
    discount,
    shippingFee,
    total,
    paymentMethod,
    couponCode,
    status: paymentMethod === 'cod' ? 'cod_confirmed' : 'pending_payment',
    razorpayOrderId: null,
    razorpayPaymentId: null,
    createdAt: new Date().toISOString(),
  };
  store.orders.push(orderRecord);
  writeStore(store);

  const shippingLabel = shippingFee === 0 ? 'FREE' : `₹${shippingFee}`;

  if (paymentMethod === 'cod') {
    return res.status(201).json({
      orderRef,
      subtotal,
      discount,
      shipping: shippingLabel,
      total,
      paymentMode: 'cod',
      message: 'COD order placed. Pay when your vault drop arrives.',
    });
  }

  if (!razorpayEnabled) {
    orderRecord.status = 'demo_confirmed';
    writeStore(store);
    return res.status(201).json({
      orderRef,
      subtotal,
      discount,
      shipping: shippingLabel,
      total,
      paymentMode: 'demo',
      message:
        'Demo checkout (add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET for live UPI/cards).',
    });
  }

  try {
    const rzpOrder = await razorpayClient.orders.create({
      amount: Math.round(total * 100),
      currency: 'INR',
      receipt: orderRef,
      notes: { store: 'velvetclap25', orderRef },
    });

    orderRecord.razorpayOrderId = rzpOrder.id;
    writeStore(store);

    return res.status(201).json({
      orderRef,
      subtotal,
      discount,
      shipping: shippingLabel,
      total,
      paymentMode: 'razorpay',
      razorpay: {
        keyId: RAZORPAY_KEY_ID,
        orderId: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
      },
      message: 'Complete payment in the Razorpay secure window.',
    });
  } catch (err) {
    orderRecord.status = 'payment_failed';
    writeStore(store);
    return res.status(502).json({
      error: 'Could not start Razorpay checkout. Try again or use COD.',
      detail: err.message,
    });
  }
});

app.post('/api/orders/verify', (req, res) => {
  if (!razorpayEnabled) {
    return res.status(400).json({ error: 'Razorpay is not configured on this server.' });
  }

  const {
    orderRef,
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
  } = req.body || {};

  if (!orderRef || !orderId || !paymentId || !signature) {
    return res.status(400).json({ error: 'Missing payment verification fields.' });
  }

  const expected = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  if (expected !== signature) {
    return res.status(400).json({ error: 'Payment signature verification failed.' });
  }

  const store = readStore();
  const order = findOrder(store, orderRef);
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  order.status = 'paid';
  order.razorpayOrderId = orderId;
  order.razorpayPaymentId = paymentId;
  order.paidAt = new Date().toISOString();
  writeStore(store);

  res.json({
    ok: true,
    orderRef,
    status: 'paid',
    message: 'Payment verified. Your vault order is confirmed!',
  });
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`VELVETCLAP25 running at http://localhost:${PORT}`);
  console.log(
    razorpayEnabled
      ? 'Razorpay: enabled (live/test per your dashboard keys)'
      : 'Razorpay: disabled — set RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET in .env'
  );
});
