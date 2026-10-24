# Requirements Traceability Matrix

**Statuses:** Implemented | Partially Implemented | Not Implemented | Needs Verification | Undecided

**Evidence:** Chat transcript (partial), `server.js`, `public/index.html`, `public/admin.html`, `README.md`, git history.

| ID | Requirement | Source / evidence | Priority | Component / file | Status | Verification | Gaps |
|----|-------------|-------------------|----------|------------------|--------|--------------|------|
| R01 | Make static HTML storefront working with backend | User: *"make this working by writing backend"* | High | `server.js`, `public/index.html` | Implemented | Run locally / Render | — |
| R02 | Publish using GitHub | User: GitHub account reference | High | Remote `origin` | Implemented | `git remote -v` | — |
| R03 | Deploy for client demo (Render) | User: *"deploy this on render"* | High | `render.yaml`, README | Implemented | Render dashboard | Free tier limits |
| R04 | Custom shop product images | User: custom images question | High | Admin, ImgBB/Cloudinary docs | Partially Implemented | Admin add product | Only 9 SKUs in git JSON |
| R05 | ≥20 products + shop staff workflow | User: *"atleast 20 products and shop staff"* | Medium | `STAFF-GUIDE.md`, admin | Partially Implemented | Staff adds via admin | Repo catalog < 20 |
| R06 | Free image hosting (not only Cloudinary) | User: ImgBB alternative | Medium | STAFF-GUIDE, URL validation | Implemented | ImgBB direct URLs | — |
| R07 | Nav tabs and buttons functional | User: tabs not working | High | `index.html` filters | Implemented | Click nav/filters | — |
| R08 | COD order visible to shop for packing | User: COD pack flow | High | Admin orders, `store.json` | Implemented | COD → admin queue | — |
| R09 | Mark shipped + courier/AWB | User: ship facility | High | `PATCH /api/admin/orders` | Implemented | Admin ship form | — |
| R10 | SMS on order/shipped | User: *"sms as well"* | Medium | `lib/sms.js`, MSG91 | Partially Implemented | Env + logs | Simulated without MSG91 |
| R11 | Guest checkout (no login) | User: *"without login user should be able to placed order"* | High | Orders API | Implemented | COD checkout | — |
| R12 | Auto profile name + mobile | User: profile after order | High | `upsertCustomerProfile`, vault UI | Implemented | VCU- in admin/popup | Device + server JSON |
| R13 | Email alerts (Gmail SMTP) vs SMS cost | User: email alerts request | Medium | `lib/email.js` | Implemented | Gmail env + inbox | Spam deliverability |
| R14 | Bag vault UX (see cart while address) | User: vault section error | High | Cart drawer layout | Implemented | Open bag + address | — |
| R15 | Razorpay online payment | Implied / README | Medium | Razorpay SDK | Partially Implemented | Test keys | Demo without keys |
| R16 | Order tracking for customers | Footer / track modal | Medium | `/api/track`, vault modal | Partially Implemented | Track form in vault | No dedicated track page |
| R17 | Google Search / “publish on google” | User question | Low | — | Not Implemented | — | Needs SEO/hosting strategy |
| R18 | User login / registration | Not requested in chat | — | — | Not Implemented | — | By design (guest vault) |
| R19 | Automated test suite | Not requested | — | — | Not Implemented | No test files | — |
| R20 | Persistent DB | Not explicit; ops implied | Medium | JSON files | Partially Implemented | Works until redeploy | Ephemeral on Render |
| R21 | Coupon VC25 | Storefront + API | Medium | `COUPONS`, validate API | Implemented | Apply VC25 | Single code |
| R22 | Wishlist | Original HTML feature | Low | `localStorage` | Implemented | Heart icon | Client-only |
| R23 | Newsletter signup | Storefront | Low | `POST /api/newsletter` | Implemented | Footer signup | — |
| R24 | Pincode delivery estimate | Storefront | Low | `POST /api/delivery/check` | Implemented | Pincode checker | Heuristic, not carrier API |
| R25 | Push latest fixes to GitHub | User: *"push"* | High | GitHub main | Needs Verification | Check remote HEAD | Operator deploy sync |
| R26 | Admin show customer email | User email issues | Medium | `admin.html` | Implemented | Order card | — |
| R27 | Fast order confirmation UI | User: late popup | Medium | Async notifications | Implemented | COD after deploy | Cold start separate |
| R28 | Vault “Open my vault” clarity | User confusion | Low | Vault modal UX | Implemented | Modal copy | — |

## Requirements mentioned in chat but not verified in code

| Topic | Notes |
|-------|--------|
| Exact Google indexing / Search Console | Discussed; no `sitemap.xml` or SEO pipeline in repo |
| MSG91 open-source | Answered as commercial; not a code requirement |
| Full conversation verbatim | Transcript truncated; use git commits for implementation timeline |

## Commit traceability (selected)

| Commit (short) | Relates to |
|----------------|------------|
| `59d226e` | Guest profiles, ship fields, MSG91 |
| `1eaff93` | Gmail email alerts |
| `2222431` | Vault profile UI + `/api/profile` |
| `dd79cf1` | Background SMS/email (faster checkout response) |
| `43a318d` | Cart clear after order |
