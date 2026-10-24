# VELVETCLAP25 — Documentation Index

Professional documentation for the **VELVETCLAP25** e-commerce demo/store, derived from the repository and available Cursor conversation history (not from assumptions).

| Document | Audience | Contents |
|----------|----------|----------|
| [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md) | Business, dev, QA, maintainers | Full overview, requirements, features, UI/UX, architecture, journeys |
| [REQUIREMENTS_TRACEABILITY.md](./REQUIREMENTS_TRACEABILITY.md) | PM, QA, developers | Requirement IDs, status, evidence, gaps |
| [SETUP_AND_DEPLOYMENT.md](./SETUP_AND_DEPLOYMENT.md) | Developers, DevOps | Local setup, env vars, Render deploy, troubleshooting |
| [KNOWN_ISSUES_AND_ROADMAP.md](./KNOWN_ISSUES_AND_ROADMAP.md) | Product, engineering | Bugs, debt, priorities, future features |
| [CATALOG_QA_CHECKLIST.md](./CATALOG_QA_CHECKLIST.md) | QA, shop staff | Pre-deploy catalog, filters, promo, pincode tests |

## Also in repo root

- [README.md](../README.md) — Quick start and API summary  
- [STAFF-GUIDE.md](../STAFF-GUIDE.md) — Shop staff: photos (ImgBB/Cloudinary), admin catalog, export workflow  

## Evidence and limitations

- **Chat history:** Partial access to agent transcript `c2fb0938-696c-464f-a322-e05b967a49ab` (user messages and summaries). Earlier turns may be truncated; **verify critical claims in code**.
- **Live production:** Referenced as Render (`velvetclap25.onrender.com` in conversation); exact env configuration is operator-specific and not stored in git.
- **Secrets:** Never commit `.env`; documentation lists variable **names** only.

## Quick facts (verified from repo)

| Item | Value |
|------|--------|
| Stack | Node.js ≥18, Express 4.x, static SPA in `public/index.html` |
| Data | JSON files: `data/products.json`, `data/store.json` |
| Git remote | `https://github.com/Gautampaswan/velvetclap25.git` |
| Deploy blueprint | `render.yaml` (Render free tier web service) |
| Automated tests | **None** in repository (no `test` script, no test files) |
| Catalog in git | **9** products in `data/products.json` (20+ SKUs documented as staff workflow, not all in repo) |

Last documentation pass: 2026-10-23 (based on commit history through `3c59739` per local git log).
