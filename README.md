# Jubilee Square v2

> Modernized lifestyle hub, tenant directory, and digital signage platform for **Jubilee Square** (Ang Mo Kio, Singapore).

[![Vercel Production](https://img.shields.io/badge/Vercel-Live%20Production-black?style=flat&logo=vercel)](https://jubilee-square-v2.vercel.app)
[![Node.js](https://img.shields.io/badge/Node.js-v22+-green?style=flat&logo=node.js)](https://nodejs.org/)
[![Astro](https://img.shields.io/badge/Astro-5.0-orange?style=flat&logo=astro)](https://astro.build/)
[![Fastify](https://img.shields.io/badge/Fastify-5.0-white?style=flat&logo=fastify)](https://fastify.dev/)
[![Directus](https://img.shields.io/badge/Directus-11-purple?style=flat&logo=directus)](https://directus.io/)

---

## Brand Governance & Assets

Official brand assets and vector graphics adhere strictly to the **Jubilee Square Brand Identity Guidelines (v2.1 / v2.2)** by Eng Wah Properties.

### Official Brand Assets (`apps/web/public/brand/`)
- **Master Transparent PNG**: `jubilee-square-logo.png` (High-density 1723×490 master with alpha channel)
- **White Knockout PNG**: `jubilee-square-logo-white.png` (Pure white for dark backgrounds and digital signage)
- **Vector Brandmark**: `jubilee-square-logo.svg`
- **Emblem Mark / Icon**: `jubilee-square-mark.png` / `jubilee-square-mark.svg`
- **WebP Optimized**: `jubilee-square-logo.webp` / `jubilee-square-logo-white.webp`

### Color Palette
| Token | Pantone / Hex | RGB | Application |
|---|---|---|---|
| `--jubilee-navy` | **Pantone 2745 C** (`#252F81`) | `rgb(37, 47, 129)` | Wordmark `jubilee`, primary text, `by ENGWAH` sub-brand |
| `--jubilee-red` | **Pantone 207 C** (`#C60A4D`) | `rgb(198, 10, 77)` | Solid square `sq` mark, primary CTAs, active badges |
| `--surface-dark` | Slate-950 (`#0B0F19`) | `rgb(11, 15, 25)` | Signage displays, high-contrast dark surfaces |
| `--surface-light` | Pure White (`#FFFFFF`) | `rgb(255, 255, 255)` | Main card backgrounds, standard canvas |

### Geometry & Typography
- **Clear Zone**: Minimum `0.5x` Area of Non-Interference around all 4 sides (where `x` = height of the `sq` square graphic).
- **Typography Stack**: `Plus Jakarta Sans`, `Inter`, `Arial`, sans-serif.

---

## Monorepo Architecture

```text
jubilee-square-v2/
├── apps/
│   ├── web/               # Astro 5 SSR Web Application (@jubilee/web)
│   ├── catalog-api/       # Fastify 5 REST API & Digital Signage Controller (@jubilee/catalog-api)
│   └── directus/          # Directus 11 CMS Schema Snapshots (@jubilee/directus)
├── packages/
│   ├── shared/            # Shared TypeScript types, constants & schemas (@jubilee/shared)
│   └── db/                # Repository layer with resilient local & database fallback (@jubilee/db)
├── docker-compose.yml     # Production orchestration for PostgreSQL, Directus, API & Web
└── vercel.json            # Edge deployment configuration
```

---

## Features

- **Dynamic Store Directory**: 23 verified tenants across 5 lifestyle verticals (`Dine 🍜`, `Learn 📚`, `Relax 💆`, `Shop 🛍️`, `Services 🩺`).
- **Real-Time "Open Now" Engine**: Timezone-accurate calculation pegged to `Asia/Singapore` (UTC+8) handling standard hours, scheduled closure days, and overnight rollover.
- **Predictive Search**: Instant ⌘K search autocomplete matching tenant names, categories, tags, and floor units (`#01-08`).
- **Interactive Wayfinding Drawer**: Accessible slide-over drawer with floor locators, tap-to-call, Google Maps directions, and 7-day schedule.
- **Mobile-First Experience**: Glassmorphism sticky header and fixed bottom navigation dock (`Home`, `Stores`, `Deals`, `Transit`).
- **Digital Signage Kiosk**: Real-time interactive kiosk controller (`/signage`) with rotating promotions and directory wayfinding.
- **Standards & Accessibility**: WCAG 2.1 AA compliant color contrast, Schema.org `ShoppingCenter` + `LocalBusiness` JSON-LD structured data, and `prefers-reduced-motion` animations.

---

## Getting Started

### Prerequisites
- Node.js `22.x` or higher
- npm `9.x` or higher

### Installation & Setup

```bash
# Clone the repository
git clone https://github.com/syafiqabdha/jubilee-square-v2.git
cd jubilee-square-v2

# Install dependencies
npm install

# Build all packages and applications
npm run build

# Run unit and integration test suites
npm test
```

### Local Development

```bash
# Start Astro Web Frontend (http://localhost:4321)
npm run dev:web

# Start Catalog REST API (http://localhost:4000)
npm run dev:api
```

---

## Live Deployments

- **Production URL**: [https://jubilee-square-v2.vercel.app](https://jubilee-square-v2.vercel.app)
- **API Swagger Docs**: `http://localhost:4000/docs`
- **Digital Signage**: [https://jubilee-square-v2.vercel.app/signage](https://jubilee-square-v2.vercel.app/signage)
