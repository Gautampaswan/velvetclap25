const nodemailer = require('nodemailer');

function getSmtpConfig() {
  const user = process.env.GMAIL_USER || process.env.SMTP_USER || '';
  const pass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || '';
  return { user, pass };
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

async function sendEmail({ to, subject, text, html }) {
  const recipients = String(to || '')
    .split(',')
    .map((e) => e.trim())
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
    const info = await transporter.sendMail({
      from: `"VELVETCLAP25" <${from}>`,
      to: recipients.join(', '),
      subject,
      text,
      html: html || text.replace(/\n/g, '<br/>'),
    });
    return { ok: true, messageId: info.messageId };
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
  const email = order.customer?.email;
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

async function emailCustomerShipped(order) {
  const email = order.customer?.email;
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
  emailShopNewOrder,
  emailCustomerOrderConfirm,
  emailCustomerShipped,
};
