# VELVETCLAP25

Streetwear vault storefront with Node.js API, Razorpay checkout, and COD.

## Run locally

```bash
npm install
cp .env.example .env   # add Razorpay test keys (optional)
npm start
```

Open [http://localhost:3000](http://localhost:3000).

Without Razorpay keys, checkout runs in **demo mode** (order saved, no payment gateway). With keys, the **Pay with UPI / Card** button opens Razorpay Checkout.

## Razorpay (test mode)

1. Sign up at [Razorpay Dashboard](https://dashboard.razorpay.com/).
2. **Settings → API Keys** → generate **Test** keys.
3. Set in `.env` (local) or Render environment:

   - `RAZORPAY_KEY_ID` — starts with `rzp_test_`
   - `RAZORPAY_KEY_SECRET` — test secret

4. Use [test UPI/cards](https://razorpay.com/docs/payments/payments/test-card-upi-details/) in the checkout modal.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/payments/config` | Public Razorpay key + enabled flag |
| GET | `/api/products` | Catalog filters |
| POST | `/api/orders` | `{ items, couponCode, paymentMethod: "online" \| "cod" }` |
| POST | `/api/orders/verify` | Razorpay payment signature verify |
| POST | `/api/delivery/check` | Pincode delivery estimate |
| POST | `/api/coupons/validate` | Promo codes (`VC25`) |
| POST | `/api/newsletter` | Email signup |
| GET | `/api/admin/orders` | Pack queue (admin password) |
| PATCH | `/api/admin/orders/:orderRef` | `{ "status": "packed" \| "shipped" }` |

Orders, **customer profiles** (by mobile), and newsletter: `data/store.json`.

- **Guest checkout** — no login; name + phone + address creates/updates a **Vault profile** (`VCU-…`).
- **Admin** — `/admin.html` → pack → enter courier + AWB → **Mark shipped + notify customer**.
- **Email (free)** — Gmail SMTP sends **new-order alerts** to your shop inbox (`GMAIL_USER` + `GMAIL_APP_PASSWORD` + optional `SHOP_ORDERS_EMAIL`). Customers who enter email get confirm + shipped mail. No third-party SMS cost.
- **SMS (optional)** — set `MSG91_AUTH_KEY` on Render, or set `ORDER_SMS=false` for email-only.
- **Track API** — `GET /api/track?orderRef=…&phone=10digits`

### Gmail SMTP on Render (recommended for zero SMS cost)

1. Google Account → **Security** → enable **2-Step Verification**.
2. **App passwords** → create one for “Mail” → copy the 16-character password.
3. On Render **Environment**, set:
   - `GMAIL_USER` — your Gmail address
   - `GMAIL_APP_PASSWORD` — the app password (not your login password)
   - `SHOP_ORDERS_EMAIL` — same Gmail or another inbox for alerts
4. Optional: `ORDER_SMS=false` to skip MSG91 entirely.

## Shop staff: photos & products (20+ SKUs)

**→ [STAFF-GUIDE.md](./STAFF-GUIDE.md)** — Cloudinary upload checklist, image sizes, export/sync workflow.

| Task | Where |
|------|--------|
| Upload photos | [Cloudinary](https://cloudinary.com) Media Library |
| Add / remove products | **`/admin.html`** on your live URL (password: `ADMIN_PASSWORD`) |
| Local images (fallback) | `public/products/your-file.jpg` → URL `/products/your-file.jpg` |
| Backup catalog | Admin → **Export catalog JSON** → commit to GitHub |

Set `ADMIN_PASSWORD` in `.env` locally and on **Render → Environment** before sharing admin with staff.

## Deploy on Render (free) — client demo

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Gautampaswan/velvetclap25)

1. Click **Deploy to Render** (or open the link above).
2. Sign in with **GitHub** (`Gautampaswan`) and approve access if asked.
3. Review the blueprint (`velvetclap25` web service) → **Apply** / **Deploy Blueprint**.
4. Wait ~2–3 minutes; open the `https://velvetclap25.onrender.com` URL (name may vary slightly).
5. *(Optional)* Add `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` under **Environment** for live UPI; demo works without them.

**Note:** Free tier sleeps after ~15 min idle; first visit may take ~30s to wake up.

GitHub Pages cannot run this API; use Render (or Railway/Fly.io).
