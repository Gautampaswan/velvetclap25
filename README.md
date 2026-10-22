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

Orders and newsletter data: `data/store.json`.

## Deploy on Render (free)

1. Repo: [github.com/Gautampaswan/velvetclap25](https://github.com/Gautampaswan/velvetclap25)
2. [Render](https://render.com) → **New Blueprint** → select repo (uses `render.yaml`).
3. In the service **Environment**, add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
4. Deploy; use the `*.onrender.com` URL as your live store.

GitHub Pages cannot run this API; use Render (or Railway/Fly.io).
