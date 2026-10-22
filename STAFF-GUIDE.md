# VELVETCLAP25 — Staff product & photo guide

For shop staff adding **20+ products** with real photos. Developers: sync changes to GitHub after major catalog updates (see below).

## 1. Upload photos to Cloudinary (recommended)

1. Sign in at [cloudinary.com](https://cloudinary.com) (free tier is enough to start).
2. **Media Library → Upload** → upload the garment photo.
3. Open the asset → **Copy URL** (must start with `https://res.cloudinary.com/...`).
4. Use that URL in the admin form **Image URL** field.

### Photo checklist (every SKU)

| Rule | Detail |
|------|--------|
| **Aspect ratio** | Portrait **4:5** (e.g. 800×1000 px) — matches the site grid |
| **Background** | Plain wall or studio; same style across products |
| **File size** | Compress to **under ~800 KB** ([squoosh.app](https://squoosh.app)) |
| **Naming** | `velvetclap25/tees/black-boxy-front.jpg` in Cloudinary folders |
| **One URL per color** | Black tee and white tee = two color rows, two URLs |

The server auto-adds Cloudinary sizing (`800×1000`, smart crop) when `CLOUDINARY_AUTO_TRANSFORM` is not disabled.

## 2. Local fallback (occasional use)

For a few files only (developer workflow):

1. Put JPG/WEBP in `public/products/` (e.g. `public/products/vc107-front.jpg`).
2. Image URL in admin: `/products/vc107-front.jpg`
3. **Commit + push** to GitHub so Render shows the file.

Staff should prefer **Cloudinary**, not Git.

## 3. Add products in the admin panel

1. Open **`https://YOUR-RENDER-URL.onrender.com/admin.html`**
2. Enter the **admin password** (set as `ADMIN_PASSWORD` on Render — ask your tech lead).
3. Fill the form: title, price, category, sizes, **Cloudinary image URL**, stock.
4. Click **Add product** — it appears on the shop immediately.

### Categories & fits (must match exactly)

- **Categories:** `tees`, `bottoms`, `accessories`, `headwear`
- **Fits:** `Oversized`, `Boxy Fit`, `Relaxed Fit`, `Straight Cut`
- **Tag types:** `lime`, `purple`, `urgent` (badge colors)

## 4. After staff edits on Render (important)

Render saves `data/products.json` on the server, but **a new deploy from GitHub can overwrite** catalog changes unless someone:

1. In admin, click **Export catalog JSON**, or call `GET /api/admin/products/export` with the password.
2. Replace `data/products.json` in the repo with that file.
3. `git commit` + `git push` → permanent backup.

Until you move to a database, do an **export + push** weekly or after big drops.

## 5. JSON reference (if editing by hand)

```json
{
  "id": "vc-107",
  "title": "YOUR PRODUCT NAME",
  "subtitle": "Short spec line",
  "category": "tees",
  "fit": "Oversized",
  "tag": "NEW DROP",
  "tagType": "lime",
  "discount": "40% OFF",
  "price": 599,
  "originalPrice": 999,
  "rating": 4.8,
  "reviewsCount": 0,
  "colors": [
    {
      "name": "Black",
      "hex": "#161616",
      "image": "https://res.cloudinary.com/YOUR-CLOUD/image/upload/v123/velvetclap25/tee-black.jpg"
    }
  ],
  "sizes": ["S", "M", "L", "XL"],
  "stockLeft": 10,
  "details": "Full description for product page."
}
```

## 6. Who to contact

- **New password / Render env:** tech lead  
- **Razorpay live payments:** tech lead + Razorpay KYC  
- **Wrong photo or price:** edit in admin or ask tech to export/sync JSON
