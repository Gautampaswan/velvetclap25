# Catalog & storefront QA checklist

Use this before each **Manual Deploy** on Render and after bulk admin catalog changes. Tick every row; note failures in your staff log.

## Environment

| Step | Action | Pass? |
|------|--------|-------|
| E1 | Server running (`npm start` or Render live URL) | ☐ |
| E2 | `GET /api/health` returns `ok: true` | ☐ |
| E3 | After admin edits, **Export catalog JSON** and commit to Git if you need persistence | ☐ |

## Catalog load

| Step | Action | Pass? |
|------|--------|-------|
| C1 | Homepage loads product grid (not “Failed to load vault catalog”) | ☐ |
| C2 | Hero **CURATED ITEMS** count matches visible grid when filters are default (ALL / ALL sizes / All Fits) | ☐ |
| C3 | **ALL (N)** pill matches `GET /api/products` → `total` | ☐ |
| C4 | Each card shows image (not broken/black), title, price, discount badge | ☐ |
| C5 | Quick view opens; color swatches swap image URL | ☐ |
| C6 | `stockLeft` shown on card matches `data/products.json` (or admin export) | ☐ |

## Filters (desktop + mobile)

Test on **Chrome mobile emulation** (375px) and desktop. After each change, grid should update without full page reload.

| Nav tab | Expected behavior | Pass? |
|---------|---------------------|-------|
| DROPS | Full catalog, default sort | ☐ |
| MEN | Men + unisex only | ☐ |
| WOMEN | Women + unisex only | ☐ |
| OVERSIZED | Tees + Oversized fit | ☐ |
| CARGOS | Bottoms + search “cargo” | ☐ |
| COLLABS | `collection: collab` only | ☐ |
| SALE | Sort price low, max price ₹999 | ☐ |

| Control | Test | Pass? |
|---------|------|-------|
| Category pills | tees, bottoms, accessories, headwear | ☐ |
| Size | M only — only products with size M | ☐ |
| Fit | Boxy Fit, Oversized, etc. | ☐ |
| Sort | price low / high, discount, rating | ☐ |
| Search | Partial title match | ☐ |
| Empty state | Combine filters until zero results → message + **Reset All Filters** restores grid | ☐ |

## Cart & promo

| Step | Action | Pass? |
|------|--------|-------|
| P1 | Add item → bag count and subtotal correct | ☐ |
| P2 | **VC25** with subtotal **&lt; ₹799** → rejected with clear message | ☐ |
| P3 | **VC25** with subtotal **≥ ₹799** → ₹300 off, total updates | ☐ |
| P4 | Remove items so subtotal &lt; ₹799 → promo auto-removed | ☐ |
| P5 | Place test COD order (or Razorpay test) — server rejects invalid coupon same as UI | ☐ |

## Delivery checker

| Pincode | Expected tier | Pass? |
|---------|---------------|-------|
| `248001` | Dehradun local (lime message) | ☐ |
| `249401` | Uttarakhand regional (if in server list) | ☐ |
| `110016` | Metro express lane | ☐ |
| `500001` | Pan-India standard | ☐ |
| `12345` | Invalid — error | ☐ |

## Trust copy (spot check)

| Item | Pass? |
|------|-------|
| No fake “84% reserved” or “₹700 avg savings” bars | ☐ |
| No random fake “someone just bought” toasts | ☐ |
| Hero mentions Dehradun-first positioning | ☐ |
| Returns/shipping modals match what you can actually offer | ☐ |

## Admin (staff)

| Step | Action | Pass? |
|------|--------|-------|
| A1 | Login to `/admin.html` | ☐ |
| A2 | Add SKU with **direct** image URL (`i.ibb.co` or Cloudinary, not `ibb.co` page link) | ☐ |
| A3 | New SKU appears on storefront after refresh | ☐ |
| A4 | Export JSON downloaded and backed up | ☐ |

## Regression smoke (5 min)

1. Filter **WOMEN** → add to bag → **VC25** → checkout fields validate.  
2. **248001** delivery check → local message.  
3. Vault profile footer → track with phone from a test order.

---

**Owner:** Shop + dev  
**Last updated:** 2026-10-23 (Dehradun delivery tiers, VC25 min ₹799, trust copy cleanup)
