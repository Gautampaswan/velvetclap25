const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { sendSms } = require('./lib/sms');
const {
  emailShopNewOrder,
  emailShopOrderShipped,
  emailCustomerOrderConfirm,
  emailCustomerShipped,
  isEmailConfigured,
  customerEmailNeedsResend,
} = require('./lib/email');
const { normalizeAudience, matchesProductSearch } = require('./lib/catalogSearch');
const { buildSupportReply, getSupportContacts } = require('./lib/supportBot');

const orderSmsEnabled = () => process.env.ORDER_SMS !== 'false';
const orderEmailShopEnabled = () => process.env.ORDER_EMAIL_SHOP !== 'false';

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

const productsPath = path.join(__dirname, 'data', 'products.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const CLOUDINARY_CATALOG_TRANSFORM =
  process.env.CLOUDINARY_CATALOG_TRANSFORM || 'w_800,h_1000,c_fill,f_auto,q_auto';
const cloudinaryAutoTransform = process.env.CLOUDINARY_AUTO_TRANSFORM !== 'false';

function loadProductsRaw() {
  return JSON.parse(fs.readFileSync(productsPath, 'utf8'));
}

function saveProductsRaw(list) {
  fs.writeFileSync(productsPath, JSON.stringify(list, null, 2), 'utf8');
}

let products = loadProductsRaw();

function optimizeCatalogImage(url) {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('/')) return url;
  if (!cloudinaryAutoTransform) return url;
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  if (url.includes(CLOUDINARY_CATALOG_TRANSFORM)) return url;
  return url.replace('/upload/', `/upload/${CLOUDINARY_CATALOG_TRANSFORM}/`);
}

function withOptimizedImages(product) {
  return {
    ...product,
    colors: (product.colors || []).map((c) => ({
      ...c,
      image: optimizeCatalogImage(c.image),
    })),
  };
}

function reloadProducts() {
  products = loadProductsRaw();
  return products;
}

function requireAdmin(req, res, next) {
  if (!ADMIN_PASSWORD) {
    return res.status(503).json({
      error: 'Admin not configured. Set ADMIN_PASSWORD on the server (Render → Environment).',
    });
  }
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid admin password.' });
  }
  next();
}

function nextProductId(list) {
  const nums = list
    .map((p) => p.id)
    .filter((id) => /^vc-\d+$/.test(id))
    .map((id) => parseInt(id.replace('vc-', ''), 10));
  const next = nums.length ? Math.max(...nums) + 1 : 101;
  return `vc-${next}`;
}

function validateImageUrl(url) {
  const img = String(url || '').trim();
  if (!img) return 'image URL is required';
  if (!img.startsWith('/') && !/^https?:\/\//i.test(img)) {
    return 'image must be https URL or /products/... path';
  }
  if (/^https?:\/\/(www\.)?ibb\.co\//i.test(img) && !/^https?:\/\/i\.ibb\.co\//i.test(img)) {
    return 'ImgBB: use the Direct link (https://i.ibb.co/.../file.jpg), not the page link (https://ibb.co/...)';
  }
  if (/drive\.google\.com|dropbox\.com|facebook\.com|instagram\.com/i.test(img)) {
    return 'use a direct image URL (ends in .jpg/.png/.webp or i.ibb.co), not a share page';
  }
  return null;
}

function validateProductInput(body, { partial } = {}) {
  const errors = [];
  if (!partial || body.title !== undefined) {
    if (!String(body.title || '').trim()) errors.push('title is required');
  }
  if (!partial || body.price !== undefined) {
    if (!Number.isFinite(Number(body.price)) || Number(body.price) < 1) {
      errors.push('price must be a positive number');
    }
  }
  if (body.colors !== undefined) {
    if (!Array.isArray(body.colors) || body.colors.length === 0) {
      errors.push('at least one color with image is required');
    } else {
      for (const c of body.colors) {
        const imgErr = validateImageUrl(c.image);
        if (imgErr) errors.push(imgErr);
      }
    }
  }
  return errors;
}

const storePath = path.join(__dirname, 'data', 'store.json');

function ensureStoreShape(store) {
  if (!store.newsletter) store.newsletter = [];
  if (!store.orders) store.orders = [];
  if (!store.customers) store.customers = {};
  return store;
}

function readStore() {
  if (!fs.existsSync(storePath)) {
    return ensureStoreShape({ newsletter: [], orders: [], customers: {} });
  }
  return ensureStoreShape(JSON.parse(fs.readFileSync(storePath, 'utf8')));
}

function upsertCustomerProfile(store, customer, orderRef) {
  const phone = String(customer.phone || '').trim();
  let profile = store.customers[phone];
  if (!profile) {
    profile = {
      profileId: `VCU-${Date.now().toString(36).toUpperCase()}`,
      phone,
      name: customer.name,
      address: customer.address,
      pincode: customer.pincode,
      email: customer.email || '',
      orderRefs: [],
      createdAt: new Date().toISOString(),
    };
    store.customers[phone] = profile;
  } else {
    profile.name = customer.name;
    profile.address = customer.address;
    profile.pincode = customer.pincode;
    if (customer.email) profile.email = customer.email;
    profile.updatedAt = new Date().toISOString();
  }
  if (!profile.orderRefs.includes(orderRef)) profile.orderRefs.push(orderRef);
  return profile;
}

function customerProfilePayload(profile) {
  if (!profile) return null;
  return {
    profileId: profile.profileId,
    name: profile.name,
    phone: profile.phone,
    pincode: profile.pincode,
    address: profile.address,
    email: profile.email || '',
  };
}

async function runOrderConfirmNotifications(orderRef) {
  const store = readStore();
  const order = findOrder(store, orderRef);
  if (!order) return;

  const phone = order.customer?.phone;
  if (orderSmsEnabled() && phone && !order.smsOrderConfirm) {
    const codNote = order.paymentMethod === 'cod' ? 'COD on delivery.' : 'Thank you!';
    const smsText = `VELVETCLAP25: Order ${orderRef} confirmed. Total Rs${order.total}. ${codNote} Vault ID ${order.customerProfileId || ''}`;
    order.smsOrderConfirm = await sendSms(phone, smsText);
  }
  if (orderEmailShopEnabled() && !order.emailShopAlert) {
    order.emailShopAlert = await emailShopNewOrder(order);
  }
  if (
    order.customer?.email &&
    customerEmailNeedsResend(order.emailCustomerConfirm)
  ) {
    order.emailCustomerConfirm = await emailCustomerOrderConfirm(order);
  }
  writeStore(store);
}

function queueOrderConfirmNotifications(orderRef) {
  setImmediate(() => {
    runOrderConfirmNotifications(orderRef).catch((err) => {
      console.error('[Order notifications]', orderRef, err.message);
    });
  });
}

async function runShippedNotifications(orderRef, { sendSms = true, sendEmail = true } = {}) {
  const store = readStore();
  const order = findOrder(store, orderRef);
  if (!order || order.status !== 'shipped') return;

  let smsResult = null;
  let emailResult = null;
  const phone = order.customer?.phone;
  if (sendSms && phone && orderSmsEnabled()) {
    const awb = order.trackingNumber ? ` AWB: ${order.trackingNumber}.` : '';
    const track = order.trackingUrl ? ` Track: ${order.trackingUrl}` : '';
    const smsText = `VELVETCLAP25: Order ${order.orderRef} SHIPPED via ${order.courier}.${awb}${track} — thank you!`;
    smsResult = await sendSms(phone, smsText);
    order.lastSms = { type: 'shipped', at: new Date().toISOString(), result: smsResult };
  }
  if (sendEmail) {
    const emailShop = orderEmailShopEnabled() ? await emailShopOrderShipped(order) : null;
    const emailCustomer = await emailCustomerShipped(order);
    emailResult = { shop: emailShop, customer: emailCustomer };
    order.lastEmail = { type: 'shipped', at: new Date().toISOString(), result: emailResult };
  }
  writeStore(store);
}

function queueShippedNotifications(orderRef, opts) {
  setImmediate(() => {
    runShippedNotifications(orderRef, opts).catch((err) => {
      console.error('[Shipped notifications]', orderRef, err.message);
    });
  });
}

function writeStore(store) {
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
}

function findOrder(store, orderRef) {
  return store.orders.find((o) => o.orderRef === orderRef);
}

const COUPONS = {
  VC25: {
    discount: 300,
    label: 'APP PROMO (VC25)',
    minSubtotal: 799,
    description: 'Flat ₹300 off when cart subtotal is ₹799 or more (before shipping).',
  },
};

/** Dehradun & nearby Uttarakhand (first 3 digits of Indian pincode). Adjust as ops expand. */
const DEHRADUN_PIN_PREFIXES = ['248'];
const UTTARAKHAND_REGIONAL_PREFIXES = ['249', '262', '263'];

const EXPRESS_PIN_PREFIXES = ['400', '401', '110', '122', '201', '560', '561', '562'];

function normalizeCouponCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function evaluateCoupon(codeRaw, subtotal) {
  const code = normalizeCouponCode(codeRaw);
  if (!code) return { ok: false, status: 400, message: 'Enter a promo code.' };
  const coupon = COUPONS[code];
  if (!coupon) {
    return { ok: false, status: 400, message: 'INVALID VOUCHER CODE. USE "VC25"' };
  }
  const sub = Math.max(0, Number(subtotal) || 0);
  const minSubtotal = Number(coupon.minSubtotal) || 0;
  if (sub < minSubtotal) {
    return {
      ok: false,
      status: 400,
      message: `CODE ${code} REQUIRES CART SUBTOTAL ₹${minSubtotal}+ (YOURS: ₹${sub}).`,
    };
  }
  return {
    ok: true,
    code,
    discount: coupon.discount,
    label: coupon.label,
    minSubtotal,
    message: `CODE ${code} APPLIED: FLAT ₹${coupon.discount} OFF ACTIVATED!`,
  };
}

function getDeliveryTier(pin) {
  const prefix = pin.slice(0, 3);
  if (DEHRADUN_PIN_PREFIXES.includes(prefix)) return 'dehradun-local';
  if (UTTARAKHAND_REGIONAL_PREFIXES.includes(prefix)) return 'uttarakhand-regional';
  if (EXPRESS_PIN_PREFIXES.includes(prefix)) return 'express-metro';
  return 'standard';
}

function deliveryMessageForTier(tier, pin) {
  switch (tier) {
    case 'dehradun-local':
      return `PINCODE ${pin} — DEHRADUN LOCAL. TYPICAL 1–2 BUSINESS DAYS AFTER DISPATCH. LOCAL PICKUP BY APPOINTMENT — CONTACT US ON CHECKOUT WHATSAPP.`;
    case 'uttarakhand-regional':
      return `PINCODE ${pin} — UTTARAKHAND REGIONAL. TYPICAL 2–4 BUSINESS DAYS AFTER DISPATCH.`;
    case 'express-metro':
      return `PINCODE ${pin} — METRO EXPRESS LANE. TYPICAL 1–3 BUSINESS DAYS (CARRIER & PIN DEPENDENT). ORDER BEFORE 4 PM FOR SAME-DAY DISPATCH WHEN POSSIBLE.`;
    default:
      return `PINCODE ${pin} — PAN-INDIA STANDARD. TYPICAL 3–6 BUSINESS DAYS. FREE SHIPPING ON ORDERS OVER ₹999.`;
  }
}

function filterProducts(query) {
  let list = [...products];
  const { category, size, fit, sort, q, audience, maxPrice, collection, promo } = query;

  if (audience && audience !== 'all') {
    const aud = String(audience).toLowerCase();
    if (aud === 'men') {
      list = list.filter((p) => {
        const a = normalizeAudience(p.audience);
        return a === 'men' || a === 'unisex';
      });
    } else if (aud === 'women') {
      list = list.filter((p) => {
        const a = normalizeAudience(p.audience);
        return a === 'women' || a === 'unisex';
      });
    }
  }

  if (collection && collection !== 'all') {
    list = list.filter((p) => p.collection === collection);
  }

  if (maxPrice && Number(maxPrice) > 0) {
    const cap = Number(maxPrice);
    list = list.filter((p) => p.price <= cap);
  }

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
    list = list.filter((p) => matchesProductSearch(p, q));
  }

  if (promo === 'genz') {
    list = list.filter((p) => {
      const fit = String(p.fit || '').toLowerCase();
      return (
        fit.includes('oversized') ||
        fit.includes('boxy') ||
        p.tagType === 'purple' ||
        p.tagType === 'lime'
      );
    });
  } else if (promo === 'weekend') {
    list = list.filter((p) => {
      const off = parseInt(String(p.discount || '0'), 10) || 0;
      return p.price <= 999 && off >= 40;
    });
  }

  const sortBy = sort || 'trending';
  if (sortBy === 'price-low') list.sort((a, b) => a.price - b.price);
  else if (sortBy === 'price-high') list.sort((a, b) => b.price - a.price);
  else if (sortBy === 'discount') {
    list.sort(
      (a, b) => parseInt(b.discount, 10) - parseInt(a.discount, 10)
    );
  } else if (sortBy === 'rating') list.sort((a, b) => b.rating - a.rating);

  return list.map(withOptimizedImages);
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
  let appliedCoupon = null;
  const code = normalizeCouponCode(couponCode);
  if (code) {
    const couponResult = evaluateCoupon(code, subtotal);
    if (!couponResult.ok) {
      return { error: couponResult.message, status: couponResult.status };
    }
    discount = couponResult.discount;
    appliedCoupon = couponResult.code;
  }

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
    couponCode: appliedCoupon,
  };
}

app.get('/api/support/config', (_req, res) => {
  const contacts = getSupportContacts();
  res.json({
    brand: 'Velvetclap Help desk',
    tagline: 'Find in-site products · FAQs · WhatsApp handoff',
    ...contacts,
  });
});

app.post('/api/support/chat', (req, res) => {
  reloadProducts();
  const message = String(req.body?.message || '').trim();
  if (message.length > 500) {
    return res.status(400).json({ error: 'Message too long (max 500 characters).' });
  }
  const payload = buildSupportReply(message, products);
  res.json({ ok: true, ...payload });
});

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
  reloadProducts();
  res.json({ products: filterProducts(req.query), total: products.length });
});

app.get('/api/products/:id', (req, res) => {
  reloadProducts();
  const product = products.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(withOptimizedImages(product));
});

app.get('/STAFF-GUIDE.md', (_req, res) => {
  res.sendFile(path.join(__dirname, 'STAFF-GUIDE.md'));
});

app.get('/api/admin/status', (_req, res) => {
  res.json({ adminEnabled: Boolean(ADMIN_PASSWORD) });
});

app.get('/api/admin/products', requireAdmin, (_req, res) => {
  reloadProducts();
  res.json({
    products: products.map(withOptimizedImages),
    count: products.length,
  });
});

app.get('/api/admin/products/export', requireAdmin, (_req, res) => {
  reloadProducts();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="products.json"');
  res.send(JSON.stringify(products, null, 2));
});

app.post('/api/admin/products', requireAdmin, (req, res) => {
  reloadProducts();
  const body = req.body || {};
  const errors = validateProductInput(body);
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });

  const price = Number(body.price);
  const originalPrice = Number(body.originalPrice) || Math.round(price * 2);
  const product = {
    id: body.id && String(body.id).trim() ? String(body.id).trim() : nextProductId(products),
    title: String(body.title).trim().toUpperCase(),
    subtitle: String(body.subtitle || '').trim(),
    category: body.category || 'tees',
    fit: body.fit || 'Oversized',
    tag: body.tag || 'NEW DROP',
    tagType: body.tagType || 'lime',
    discount: body.discount || `${Math.max(0, Math.round((1 - price / originalPrice) * 100))}% OFF`,
    price,
    originalPrice,
    rating: Number(body.rating) || 4.8,
    reviewsCount: Number(body.reviewsCount) || 0,
    colors: body.colors.map((c) => ({
      name: c.name || 'Default',
      hex: c.hex || '#262626',
      image: String(c.image).trim(),
    })),
    sizes: Array.isArray(body.sizes) && body.sizes.length ? body.sizes : ['S', 'M', 'L', 'XL'],
    stockLeft: Number(body.stockLeft) ?? 10,
    details: String(body.details || '').trim(),
    audience: normalizeAudience(body.audience || 'unisex'),
    collection: body.collection || null,
  };

  if (products.some((p) => p.id === product.id)) {
    return res.status(409).json({ error: `Product id ${product.id} already exists` });
  }

  products.push(product);
  saveProductsRaw(products);
  res.status(201).json({ ok: true, product: withOptimizedImages(product) });
});

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  reloadProducts();
  const before = products.length;
  products = products.filter((p) => p.id !== req.params.id);
  if (products.length === before) {
    return res.status(404).json({ error: 'Product not found' });
  }
  saveProductsRaw(products);
  res.json({ ok: true, removed: req.params.id });
});

const FULFILLMENT_STATUSES = ['cod_confirmed', 'paid', 'demo_confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];

function validateCustomerForOrder(customer) {
  const c = customer || {};
  if (!String(c.name || '').trim()) return 'Customer name is required for delivery.';
  if (!/^\d{10}$/.test(String(c.phone || '').trim())) return 'Valid 10-digit phone required.';
  if (!/^\d{6}$/.test(String(c.pincode || '').trim())) return 'Valid 6-digit pincode required.';
  if (String(c.address || '').trim().length < 10) return 'Full delivery address required.';
  const email = String(c.email || '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email address.';
  return null;
}

app.post('/api/admin/orders/:orderRef/resend-customer-email', requireAdmin, async (req, res) => {
  const store = readStore();
  const order = findOrder(store, req.params.orderRef);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (!order.customer?.email?.trim()) {
    return res.status(400).json({ error: 'No customer email on this order.' });
  }
  if (!isEmailConfigured()) {
    return res.status(400).json({
      error: 'Gmail SMTP not configured on server (GMAIL_USER + GMAIL_APP_PASSWORD).',
    });
  }

  const mode = String(req.body?.mode || 'both').toLowerCase();
  const result = { confirm: null, shipped: null };

  if (mode === 'confirm' || mode === 'both') {
    result.confirm = await emailCustomerOrderConfirm(order);
    order.emailCustomerConfirm = result.confirm;
  }
  if ((mode === 'shipped' || mode === 'both') && order.status === 'shipped') {
    result.shipped = await emailCustomerShipped(order);
    order.lastEmail = {
      type: 'shipped_resend',
      at: new Date().toISOString(),
      result: { customer: result.shipped },
    };
  }

  writeStore(store);
  res.json({ ok: true, orderRef: order.orderRef, result });
});

app.get('/api/admin/notifications/status', requireAdmin, (_req, res) => {
  const smsConfigured = Boolean(process.env.MSG91_AUTH_KEY?.trim());
  res.json({
    emailConfigured: isEmailConfigured(),
    smsConfigured,
    shopOrdersEmail:
      process.env.SHOP_ORDERS_EMAIL?.trim() ||
      process.env.GMAIL_USER?.trim() ||
      process.env.SMTP_USER?.trim() ||
      null,
    hint: isEmailConfigured()
      ? 'Real emails will send to shop inbox and customer email on orders.'
      : 'Add GMAIL_USER + GMAIL_APP_PASSWORD on Render (Google App Password). Until then emails are demo-only in server logs.',
  });
});

app.get('/api/admin/orders', requireAdmin, (_req, res) => {
  const store = readStore();
  const orders = [...(store.orders || [])].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  const needsPacking = orders.filter((o) =>
    ['cod_confirmed', 'paid', 'demo_confirmed'].includes(o.status)
  ).length;
  res.json({ orders, needsPacking, total: orders.length });
});

app.patch('/api/admin/orders/:orderRef', requireAdmin, async (req, res) => {
  const status = String(req.body?.status || '').trim();
  if (!FULFILLMENT_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }
  const store = readStore();
  const order = findOrder(store, req.params.orderRef);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  order.status = status;
  order.updatedAt = new Date().toISOString();

  const shipNotify =
    status === 'shipped'
      ? {
          sendSms: req.body?.sendSms !== false,
          sendEmail: req.body?.sendEmail !== false,
        }
      : null;

  if (status === 'shipped') {
    order.courier = String(req.body?.courier || 'Bluedart/Delhivery').trim();
    order.trackingNumber = String(req.body?.trackingNumber || '').trim();
    order.trackingUrl = String(req.body?.trackingUrl || '').trim();
    order.shippedAt = new Date().toISOString();
  }

  writeStore(store);

  if (shipNotify) {
    queueShippedNotifications(order.orderRef, shipNotify);
  }

  res.json({
    ok: true,
    orderRef: order.orderRef,
    status: order.status,
    notificationsQueued: Boolean(shipNotify),
    sms: shipNotify ? null : undefined,
    email: shipNotify ? null : undefined,
  });
});

app.get('/api/admin/customers', requireAdmin, (_req, res) => {
  const store = readStore();
  const list = Object.values(store.customers || {}).sort(
    (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
  );
  res.json({ customers: list, total: list.length });
});

app.get('/api/track', (req, res) => {
  const orderRef = String(req.query.orderRef || '').trim();
  const phone = String(req.query.phone || '').replace(/\D/g, '').slice(-10);
  if (!orderRef || !/^\d{10}$/.test(phone)) {
    return res.status(400).json({ error: 'Provide orderRef and 10-digit phone.' });
  }
  const store = readStore();
  const order = findOrder(store, orderRef);
  if (!order || order.customer?.phone !== phone) {
    return res.status(404).json({ error: 'Order not found for this phone.' });
  }
  res.json({
    orderRef: order.orderRef,
    status: order.status,
    total: order.total,
    paymentMethod: order.paymentMethod,
    courier: order.courier || null,
    trackingNumber: order.trackingNumber || null,
    trackingUrl: order.trackingUrl || null,
    shippedAt: order.shippedAt || null,
    createdAt: order.createdAt,
    customerProfileId: order.customerProfileId || null,
  });
});

app.get('/api/profile', (req, res) => {
  const phone = String(req.query.phone || '').replace(/\D/g, '').slice(-10);
  if (!/^\d{10}$/.test(phone)) {
    return res.status(400).json({ error: 'Valid 10-digit mobile required.' });
  }
  const store = readStore();
  const profile = store.customers?.[phone];
  if (!profile) {
    return res.status(404).json({
      error: 'No vault profile yet. Place an order with this mobile — your profile is created automatically at checkout.',
    });
  }
  const orders = (profile.orderRefs || [])
    .map((ref) => findOrder(store, ref))
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((o) => ({
      orderRef: o.orderRef,
      status: o.status,
      total: o.total,
      paymentMethod: o.paymentMethod,
      createdAt: o.createdAt,
      courier: o.courier || null,
      trackingNumber: o.trackingNumber || null,
      trackingUrl: o.trackingUrl || null,
    }));
  res.json({
    profile: customerProfilePayload(profile),
    orders,
  });
});

app.post('/api/delivery/check', (req, res) => {
  const pin = String(req.body.pincode || '').trim();
  if (!/^\d{6}$/.test(pin)) {
    return res.status(400).json({
      valid: false,
      message: 'PLEASE ENTER A VALID 6-DIGIT INDIAN PINCODE.',
    });
  }
  const tier = getDeliveryTier(pin);
  const expressAvailable = tier === 'express-metro' || tier === 'dehradun-local';
  res.json({
    valid: true,
    pincode: pin,
    tier,
    expressAvailable,
    message: deliveryMessageForTier(tier, pin),
  });
});

app.post('/api/coupons/validate', (req, res) => {
  const subtotal = Number(req.body.subtotal) || 0;
  const result = evaluateCoupon(req.body.code, subtotal);
  if (!result.ok) {
    return res.status(result.status).json({
      valid: false,
      message: result.message,
    });
  }
  res.json({
    valid: true,
    code: result.code,
    discount: result.discount,
    label: result.label,
    minSubtotal: result.minSubtotal,
    message: result.message,
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
  reloadProducts();
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

  const customerErr = validateCustomerForOrder(customer);
  if (customerErr) {
    return res.status(400).json({ error: customerErr });
  }

  const deliveryCustomer = {
    name: String(customer.name || '').trim(),
    phone: String(customer.phone || '').trim(),
    pincode: String(customer.pincode || '').trim(),
    address: String(customer.address || '').trim(),
    email: String(customer.email || '').trim(),
  };

  const store = readStore();
  const orderRecord = {
    orderRef,
    items: lineItems,
    customer: deliveryCustomer,
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
  const profile = upsertCustomerProfile(store, deliveryCustomer, orderRef);
  orderRecord.customerProfileId = profile.profileId;
  store.orders.push(orderRecord);
  writeStore(store);

  const shippingLabel = shippingFee === 0 ? 'FREE' : `₹${shippingFee}`;

  async function finalizeOrderResponse(paymentMode, message, extra = {}) {
    writeStore(store);
    queueOrderConfirmNotifications(orderRef);
    return res.status(201).json({
      orderRef,
      subtotal,
      discount,
      shipping: shippingLabel,
      total,
      paymentMode,
      profileId: profile.profileId,
      profile: customerProfilePayload(profile),
      notificationsQueued: true,
      message,
      ...extra,
    });
  }

  if (paymentMethod === 'cod') {
    return finalizeOrderResponse(
      'cod',
      'COD order placed. Pay when your vault drop arrives. Shop gets an email alert if Gmail SMTP is configured; SMS if MSG91 is set.'
    );
  }

  if (!razorpayEnabled) {
    orderRecord.status = 'demo_confirmed';
    writeStore(store);
    return finalizeOrderResponse(
      'demo',
      'Demo checkout (add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET for live UPI/cards).'
    );
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
      profileId: profile.profileId,
      profile: customerProfilePayload(profile),
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

app.post('/api/orders/verify', async (req, res) => {
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
  queueOrderConfirmNotifications(orderRef);

  const storeProfile = order.customer?.phone
    ? store.customers[order.customer.phone]
    : null;

  res.json({
    ok: true,
    orderRef,
    status: 'paid',
    profileId: order.customerProfileId || storeProfile?.profileId,
    profile: customerProfilePayload(storeProfile),
    notificationsQueued: true,
    message: 'Payment verified. Your vault order is confirmed!',
  });
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  if (req.path.endsWith('.html') || req.path.startsWith('/products/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`VELVETCLAP25 running at http://localhost:${PORT}`);
  console.log(
    razorpayEnabled
      ? 'Razorpay: enabled (live/test per your dashboard keys)'
      : 'Razorpay: disabled — set RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET in .env'
  );
  console.log(
    ADMIN_PASSWORD
      ? 'Staff admin: /admin.html (ADMIN_PASSWORD set)'
      : 'Staff admin: disabled — set ADMIN_PASSWORD in .env or Render'
  );
});
