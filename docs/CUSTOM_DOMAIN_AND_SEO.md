# Custom domain (velvetclap.com) + Google Search

## 1. Buy the domain

Register **velvetclap.com** at a registrar (Porkbun, Spaceship, Namecheap, etc.). Confirm you control DNS for the domain.

## 2. Connect domain on Render

1. Open [Render Dashboard](https://dashboard.render.com) → your **velvetclap25** web service.
2. **Settings** → **Custom Domains** → **Add Custom Domain**.
3. Add:
   - `velvetclap.com`
   - `www.velvetclap.com` (recommended)
4. Render shows DNS records. Typical setup:

| Type | Name / Host | Value (example — use Render’s exact value) |
|------|-------------|---------------------------------------------|
| **CNAME** | `www` | `velvetclap25.onrender.com` (your service hostname) |
| **A** or **ALIAS** | `@` (root) | Render’s root instructions (often A records or ANAME) |

5. At your **registrar DNS** panel, add those records. Save and wait (minutes to 48 hours).
6. In Render, wait until the domain shows **Verified** and **Certificate issued**.
7. Optional: **Redirects** — redirect `www` → apex or apex → `www` (pick one canonical URL).

## 3. Set canonical URL on Render

In **Environment**, add:

```env
SITE_URL=https://velvetclap.com
```

Use `https://www.velvetclap.com` instead if that is your primary URL. Redeploy after saving.

This makes `/sitemap.xml` and `/robots.txt` list the correct domain for Google.

## 4. Verify the site

- Open `https://velvetclap.com` — storefront loads.
- Open `https://velvetclap.com/robots.txt` — should mention your sitemap URL.
- Open `https://velvetclap.com/sitemap.xml` — should list your homepage.

Admin (`/admin.html`) is blocked in `robots.txt` from indexing.

## 5. Google Search Console (get on Google)

1. Go to [Google Search Console](https://search.google.com/search-console).
2. **Add property** → **URL prefix** → `https://velvetclap.com`.
3. **Verify** ownership (HTML file upload, DNS TXT record, or Google Analytics — DNS TXT at registrar is common).
4. **Sitemaps** → submit: `https://velvetclap.com/sitemap.xml`.
5. **URL inspection** → enter `https://velvetclap.com/` → **Request indexing** (once after launch).

Indexing is not instant. Brand searches like **velvetclap dehradun** often appear within days to a few weeks.

## 6. Help Google and customers find you

- Link the site from **Instagram**, **WhatsApp business**, and bio links.
- Create **Google Business Profile** for Dehradun (local “near me” searches).
- Keep adding products in admin so the catalog stays fresh.

## Troubleshooting

| Issue | Action |
|-------|--------|
| Domain not verifying | Double-check CNAME/A at registrar; remove conflicting old records |
| SSL pending | Wait; ensure DNS points only to Render |
| Sitemap shows `onrender.com` | Set `SITE_URL` on Render and redeploy |
| Admin page in Google | Should not happen if `robots.txt` is deployed; use Search Console to remove URL if needed |

**Last updated:** 2026-10-30
