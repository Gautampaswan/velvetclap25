# Setup, Testing, and Deployment

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| **Node.js** | ≥ 18 (`package.json` `engines`) |
| **npm** | Bundled with Node |
| **Git** | Optional; for clone/push |
| **Accounts (optional)** | Razorpay (test), Render, Gmail (SMTP), MSG91 (SMS) |

## Local installation

```bash
git clone https://github.com/Gautampaswan/velvetclap25.git
cd velvetclap25
npm install
cp .env.example .env
```

Edit `.env` with non-secret placeholders replaced by real values where needed. **Do not commit `.env`.**

Start the server:

```bash
npm start
```

Development with auto-restart on file changes:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- Storefront: `/` (served from `public/index.html` for non-API routes)
- Staff admin: `/admin.html`
- Health check: `/api/health`

## Environment variables

See [.env.example](../.env.example). Summary:

| Variable | Required | Purpose |
|----------|----------|---------|
| `PORT` | Auto on Render | HTTP port (default 3000) |
| `ADMIN_PASSWORD` | Recommended | Bearer token for `/api/admin/*` and admin UI |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Optional | Live Razorpay checkout; without → demo checkout path |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Optional | SMTP send via Gmail app password |
| `SHOP_ORDERS_EMAIL` | Optional | Shop alert inbox (defaults to Gmail user) |
| `EMAIL_FROM_NAME` | Optional | Customer email “From” display name |
| `MSG91_AUTH_KEY` / `MSG91_SENDER_ID` | Optional | India SMS; without → simulated in logs |
| `ORDER_SMS` | Optional | Set `false` for email-only notifications |
| `ORDER_EMAIL_SHOP` | Optional | Set `false` to disable shop email alerts |
| `SMTP_*` | Optional | Generic SMTP instead of Gmail |

## Running tests

**No automated test suite exists** in this repository:

- `package.json` has no `test` script
- No `*.test.js`, spec files, or CI test workflow found

**Manual verification** (recommended):

1. `GET /api/health` → 200  
2. Browse catalog, filters, add to cart — see [CATALOG_QA_CHECKLIST.md](./CATALOG_QA_CHECKLIST.md) for full matrix  
3. COD order with valid address → admin shows order  
4. Admin: pack → ship with AWB  
5. Vault modal: mobile lookup → profile + orders  
6. `GET /api/track?orderRef=…&phone=…` with matching order  

## Production build

There is **no separate frontend build step**. Production = `npm install` + `node server.js` (see `render.yaml`).

Static assets and inline JavaScript live in `public/index.html` (large single file).

## Deploy on Render

1. Connect GitHub repo `Gautampaswan/velvetclap25`  
2. Use blueprint [render.yaml](../render.yaml) or manual Web Service  
3. **Build:** `npm install`  
4. **Start:** `npm start`  
5. **Health check path:** `/api/health`  
6. Set secrets in **Environment** (see table above)  
7. After env changes or git push: **Manual Deploy** latest commit  

### Render free tier notes

- Service **sleeps** after idle period; first request may be slow (cold start)  
- Filesystem is **ephemeral**: `data/store.json` and server-side catalog edits can be **lost on redeploy** unless exported and committed (`STAFF-GUIDE.md`)  
- **Environment** feature is available on free tier (confirmed in project chat)

## Domain and HTTPS

Render provides `*.onrender.com` with HTTPS. Custom domain: configure in Render dashboard (DNS CNAME) — **not configured in repo**.

## Troubleshooting

| Issue | Likely cause | Action |
|-------|----------------|--------|
| Black product images | ImgBB **page** URL instead of direct `i.ibb.co` | Use direct link; server rejects some page URLs |
| Checkout slow popup | Was blocking on email/SMS (fixed in `dd79cf1`) | Deploy latest; notifications now background |
| Cart not clearing after order | Old client or cancelled Razorpay | Deploy `43a318d+`; hard refresh |
| Email “demo” only | Missing Gmail env | Set `GMAIL_USER` + `GMAIL_APP_PASSWORD` on Render |
| Customer email in Spam | Personal Gmail SMTP | Mark not spam; consider transactional SMTP + domain |
| Admin 401 | Wrong/missing `ADMIN_PASSWORD` | Set on Render, redeploy |
| Razorpay not opening | Missing keys or script load | Set test keys; check browser console |
| Orders vanished after deploy | Ephemeral disk | Export catalog/orders; plan persistent DB/disk |

## Logging and monitoring

- **Logging:** `console.log` / `console.error` (SMS/email demo lines, errors)  
- **No** APM, error tracking, or structured logging in repo  
- **Backups:** Manual — export products JSON from admin; commit to GitHub; copy `store.json` if needed  

## Production readiness gaps (recommendations)

- Persistent database (PostgreSQL/SQLite with volume) for orders and catalog  
- Automated tests and CI  
- Rate limiting on public APIs (`/api/profile`, `/api/track`)  
- HTTPS-only cookies if adding real auth later  
- Transactional email provider with SPF/DKIM on custom domain  

See [KNOWN_ISSUES_AND_ROADMAP.md](./KNOWN_ISSUES_AND_ROADMAP.md).
