# VELVETCLAP25

Streetwear vault storefront with a Node.js API (products, delivery check, coupons, newsletter, orders).

## Run locally

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | Catalog (`category`, `size`, `fit`, `sort`, `q`) |
| GET | `/api/products/:id` | Single product |
| POST | `/api/delivery/check` | `{ "pincode": "400050" }` |
| POST | `/api/coupons/validate` | `{ "code": "VC25" }` |
| POST | `/api/newsletter` | `{ "email": "you@example.com" }` |
| POST | `/api/orders` | `{ "items": [...], "couponCode": "VC25" }` |

Orders and newsletter signups persist in `data/store.json`.

## Deploy (free)

1. Push this repo to GitHub.
2. [Render](https://render.com) → **New Web Service** → connect the repo.
3. Build: `npm install` · Start: `npm start` · Instance type: Free.

Or use the included `render.yaml` blueprint (**New Blueprint** on Render).

GitHub Pages only hosts static files; use Render (or Railway/Fly.io) so the API runs with the site.
