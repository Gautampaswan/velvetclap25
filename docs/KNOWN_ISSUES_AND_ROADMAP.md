# Known Issues, Gaps, and Roadmap

Priorities are **engineering judgments**, not business commitments.

## Critical

| Item | Description | Evidence |
|------|-------------|----------|
| Ephemeral persistence on Render | Orders/catalog in JSON on disk may reset on redeploy | Render free tier; README/STAFF-GUIDE warn export |
| No automated tests | Regressions caught only manually | No test script/files |

## High

| Item | Description |
|------|-------------|
| Catalog size in git | `data/products.json` has 9 products; business goal was 20+ via admin |
| Guest profile security | `/api/profile` and `/api/track` only require phone — enumerable |
| Gmail deliverability | Customer mail often lands in Spam |
| Razorpay abandoned payment | Order created `pending_payment`; user must understand retry/cancel UX |
| Admin password in browser | Staff admin stores session token in `sessionStorage` (see admin.html) |

## Medium

| Item | Description |
|------|-------------|
| Single 2200+ line `index.html` | Hard to maintain; no component framework |
| No rate limiting | Public APIs open to abuse |
| Stock not decremented on order | `stockLeft` validated on order but never reduced in catalog JSON |
| No sitemap/robots/structured data | SEO for “publish on Google” incomplete |
| No dedicated customer track page | Vault modal + API only |
| Cold start on Render free tier | 15–30s first load after sleep |
| Wishlist/cart client-only | Lost if user clears storage |

## Low

| Item | Description |
|------|-------------|
| Placeholder profile avatar | Generic image until order creates lime badge |
| Social proof toasts | Removed (2026-10-23) — was simulated purchase toasts |
| Footer “careers@velvetclap25.in” | Placeholder copy |
| Currency button | Toast only; INR fixed |

## Bugs addressed in recent history (verify on deployed commit)

- ImgBB page URLs → black images (`dc0b262`)  
- Nav tabs non-functional (`63b992b`)  
- Bag vault layout (`9f183fb`, `876a7a7`)  
- Cart not clearing (`43a318d`)  
- Late confirmation popup (`dd79cf1`)  
- Razorpay missing profileId in response (`1eaff93`)  

## Technical debt

- Migrate from JSON files to database + migrations  
- Split storefront into build pipeline (Vite/React) or templated partials  
- Centralize API client and error handling  
- Add CI (lint, smoke test on `/api/health`)  
- Structured logging + error reporting (Sentry/etc.)  

## Future roadmap (recommended)

### Phase 1 — Production ops

- Render persistent disk or managed DB  
- Nightly backup of orders  
- Domain + HTTPS + transactional email (Brevo/SES)  

### Phase 2 — Customer experience

- Dedicated `/track` page  
- SMS/email status in customer vault  
- Reduce spam (domain email)  

### Phase 3 — Commerce

- Inventory decrement and low-stock alerts  
- Multiple coupons / admin promo manager  
- Razorpay live mode + webhook hardening  

### Phase 4 — Growth

- SEO: meta tags, sitemap, Product schema  
- Optional OTP login linking to vault profile  
- Analytics (privacy-compliant)  

## UX improvements backlog

- Order success UI (replace `alert()` with in-app modal)  
- Show profile creation step in checkout progress  
- Hide “Open my vault” when profile already loaded (partially done `3c59739`)  
- Accessible focus traps in modals (audit needed)  

## Security improvements backlog

- Rate limit `/api/profile`, `/api/track`, `/api/orders`  
- Argon2/bcrypt not applicable until real user accounts  
- Rotate `ADMIN_PASSWORD`; use Render secret sync  
- CSP headers for XSS hardening  
- Audit dependency vulnerabilities (`npm audit` — run locally; not documented as passed)  
