const nodemailer = require('nodemailer');

function getSmtpConfig() {
  const user = String(process.env.GMAIL_USER || process.env.SMTP_USER || '').trim();
  const pass = String(process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || '')
    .trim()
    .replace(/\s+/g, '');
  return { user, pass };
}

function isEmailConfigured() {
  const { user, pass } = getSmtpConfig();
  return Boolean(user && pass);
}

function getTransporter() {
  const { user, pass } = getSmtpConfig();
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  });
}

function normalizeRecipientEmail(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase();
}

function shopInboxAddress() {
  return (
    normalizeRecipientEmail(process.env.SHOP_ORDERS_EMAIL) ||
    normalizeRecipientEmail(process.env.GMAIL_USER) ||
    normalizeRecipientEmail(process.env.SMTP_USER)
  );
}

function customerEmailNeedsResend(prior) {
  if (!prior) return true;
  if (prior.skipped) return false;
  if (prior.simulated) return true;
  if (prior.ok === false) return true;
  return false;
}

async function sendEmail({ to, subject, text, html, replyTo }) {
  const recipients = String(to || '')
    .split(',')
    .map((e) => normalizeRecipientEmail(e))
    .filter(Boolean);
  if (!recipients.length) {
    return { ok: false, error: 'No recipient email' };
  }

  const transporter = getTransporter();
  const from = process.env.EMAIL_FROM || getSmtpConfig().user;

  if (!transporter) {
    console.log(`[Email demo] → ${recipients.join(', ')} | ${subject}\n${text}`);
    return { ok: true, simulated: true, message: 'Email simulated (set GMAIL_USER + GMAIL_APP_PASSWORD)' };
  }

  try {
    const mail = {
      from: `"VELVETCLAP25" <${from}>`,
      to: recipients.join(', '),
      subject,
      text,
      html: html || text.replace(/\n/g, '<br/>'),
    };
    const reply = replyTo || shopInboxAddress();
    if (reply) mail.replyTo = reply;

    const info = await transporter.sendMail(mail);
    console.log(`[Email sent] → ${recipients.join(', ')} | ${subject} | ${info.messageId || 'ok'}`);
    return { ok: true, messageId: info.messageId, to: recipients.join(', ') };
  } catch (err) {
    console.error('[Email]', err.message);
    return { ok: false, error: err.message };
  }
}

function formatOrderItems(order) {
  return (order.items || [])
    .map((i) => `• ${i.title} ×${i.quantity} (${i.size}) — ₹${i.unitPrice * i.quantity}`)
    .join('\n');
}

async function emailShopNewOrder(order) {
  const shopInbox =
    process.env.SHOP_ORDERS_EMAIL || process.env.GMAIL_USER || process.env.SMTP_USER;
  const c = order.customer || {};
  const subject = `[NEW ORDER] ${order.orderRef} · ₹${order.total} · ${order.paymentMethod || 'online'}`;
  const text = `New VELVETCLAP25 order

Order ID: ${order.orderRef}
Status: ${order.status}
Payment: ${order.paymentMethod || 'online'}
Total: ₹${order.total}
Profile: ${order.customerProfileId || '—'}

Customer
Name: ${c.name || '—'}
Phone: ${c.phone || '—'}
Email: ${c.email || '—'}
Address: ${c.address || '—'}
Pincode: ${c.pincode || '—'}

Items
${formatOrderItems(order)}

Open admin: mark packed → ship when ready.`;

  return sendEmail({ to: shopInbox, subject, text });
}

async function emailCustomerOrderConfirm(order) {
  const email = normalizeRecipientEmail(order.customer?.email);
  if (!email) return { ok: false, skipped: true, reason: 'no customer email' };

  const subject = `Order confirmed — ${order.orderRef} | VELVETCLAP25`;
  const text = `Hi ${order.customer.name || 'there'},

Your vault order is confirmed.

Order ID: ${order.orderRef}
Total: ₹${order.total}
Payment: ${order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online'}

We will notify you when your package ships.

— VELVETCLAP25`;

  return sendEmail({ to: email, subject, text });
}

async function emailShopOrderShipped(order) {
  const shopInbox =
    process.env.SHOP_ORDERS_EMAIL || process.env.GMAIL_USER || process.env.SMTP_USER;
  const c = order.customer || {};
  const subject = `[SHIPPED] ${order.orderRef} · ${order.courier || 'Courier'} · AWB ${order.trackingNumber || '—'}`;
  const text = `Order marked SHIPPED in admin

Order ID: ${order.orderRef}
Customer: ${c.name || '—'} · ${c.phone || '—'}
Email: ${c.email || '(none at checkout)'}
Address: ${c.address || '—'} · PIN ${c.pincode || '—'}

Courier: ${order.courier || '—'}
AWB: ${order.trackingNumber || '—'}
${order.trackingUrl ? `Track: ${order.trackingUrl}` : ''}

Items:
${formatOrderItems(order)}`;

  return sendEmail({ to: shopInbox, subject, text });
}

async function emailCustomerShipped(order) {
  const email = normalizeRecipientEmail(order.customer?.email);
  if (!email) return { ok: false, skipped: true, reason: 'no customer email' };

  const subject = `Shipped — ${order.orderRef} | VELVETCLAP25`;
  const text = `Hi ${order.customer.name || 'there'},

Your order has shipped!

Courier: ${order.courier || '—'}
AWB: ${order.trackingNumber || '—'}
${order.trackingUrl ? `Track: ${order.trackingUrl}` : ''}

Order ID: ${order.orderRef}

— VELVETCLAP25`;

  return sendEmail({ to: email, subject, text });
}

module.exports = {
  sendEmail,
  isEmailConfigured,
  customerEmailNeedsResend,
  normalizeRecipientEmail,
  emailShopNewOrder,
  emailShopOrderShipped,
  emailCustomerOrderConfirm,
  emailCustomerShipped,
};
