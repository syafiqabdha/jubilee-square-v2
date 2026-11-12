# Jubilee Square v2

> Modernized lifestyle hub, tenant directory, and digital signage platform for **Jubilee Square** (Ang Mo Kio, Singapore).

[![Vercel Production](https://img.shields.io/badge/Vercel-Live%20Production-black?style=flat&logo=vercel)](https://jubilee-square-v2.vercel.app)
[![Node.js](https://img.shields.io/badge/Node.js-v22+-green?style=flat&logo=node.js)](https://nodejs.org/)
[![Astro](https://img.shields.io/badge/Astro-7-orange?style=flat&logo=astro)](https://astro.build/)
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
│   ├── web/               # Astro 7 SSR Web Application (@jubilee/web)
│   ├── catalog-api/       # Fastify 5 REST API & Digital Signage Controller (@jubilee/catalog-api)
│   └── directus/          # Directus 11 CMS Schema Snapshots (@jubilee/directus)
├── packages/
│   ├── shared/            # Shared TypeScript types, constants & schemas (@jubilee/shared)
│   └── db/                # Repository layer with resilient local & database fallback (@jubilee/db)
├── infra/
│   ├── docker/            # Dockerfiles for web, catalog-api and the Directus bootstrap job
│   ├── proxy/             # Caddyfile for the optional HTTPS proxy profile
│   ├── migrations/        # PostgreSQL schema + seed (runs on first boot)
│   ├── coolify/           # Deployment runbook, preflight and Coolify scripts
│   └── scripts/           # DB backup, placeholder image generator
└── docker-compose.yml     # Full production stack: PostgreSQL, Directus, API & Web
```

---

## Features

- **Dynamic Store Directory**: 23 verified tenants across 5 lifestyle verticals (`Dine 🍜`, `Learn 📚`, `Relax 💆`, `Shop 🛍️`, `Services 🩺`).
- **Real-Time "Open Now" Engine**: Timezone-accurate calculation pegged to `Asia/Singapore` (UTC+8) handling standard hours, scheduled closure days, and overnight rollover.
- **Predictive Search**: Instant ⌘K search autocomplete matching tenant names, categories, tags, and floor units (`#01-08`).
- **Interactive Wayfinding Drawer**: Accessible slide-over drawer with floor locators, tap-to-call, Google Maps directions, and 7-day schedule.
- **Interactive Building Floor Explorer**: Visual level-by-level floor plan navigator (`/location`) with tenant positioning, floor switching, and accessible keyboard controls.
- **Tactical Arrival Guide**: Step-by-step multi-modal directions (MRT, bus, car, taxi) with landmark callouts and real-time context — integrated into the location page.
- **Building Landmark Showcase**: Photo-driven landmark gallery with lightbox modal (`BuildingLightbox`) for full-resolution building imagery and ambient hero backdrop.
- **Location Visual Guide**: Dedicated `/location` page with Google Maps embed, surrounding landmark cards, and wayfinding cues for first-time visitors.
- **Mobile-First Experience**: Glassmorphism sticky header and fixed bottom navigation dock (`Home`, `Stores`, `Deals`, `Transit`).
- **Mall Pages**: About (live tenant mix and level-by-level breakdown), Contact (management email, address, map), News, and Deals (current tenant promotions, filtered by date in Singapore time).
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

# Run unit and integration test suites (builds workspaces first via `pretest`)
npm test
```

### Environment Configuration

No credentials are defaulted anywhere in this repository — production secrets must be supplied.

```bash
# Create your local env file from the template
cp .env.example .env

# Fill in the REQUIRED secrets (compose + Directus bootstrap refuse to start without them)
#   DB_PASSWORD, ADMIN_EMAIL, ADMIN_PASSWORD, KEY, SECRET
# Generate strong values with:
openssl rand -base64 32
```

`docker-compose.yml` uses required-variable syntax (`${VAR:?}`), so `docker compose up` fails fast with a clear
message instead of silently booting PostgreSQL/Directus with well-known demo credentials. The Directus bootstrap
(`npm run bootstrap --workspace=apps/directus`) exits non-zero if `ADMIN_EMAIL` / `ADMIN_PASSWORD` are unset:

```bash
set -a; . ./.env; set +a
npm run bootstrap --workspace=apps/directus
```

### Local Development

```bash
# Start Astro Web Frontend (http://localhost:4321)
npm run dev:web

# Start Catalog REST API (http://localhost:4000)
npm run dev:api
```

---

## Docker Stack Deployment

The production target is the Docker Compose stack in `docker-compose.yml` (PostgreSQL, Directus, catalog API, web,
plus optional one-shot bootstrap jobs and a Caddy HTTPS proxy). Full instructions, including Coolify, are in
[`infra/coolify/RUNBOOK.md`](infra/coolify/RUNBOOK.md).

```bash
cp .env.example .env                 # fill in the REQUIRED secrets
./infra/coolify/check-envs.sh .env   # preflight
docker compose up -d --build

# first deploy only
docker compose --profile bootstrap run --rm directus-schema
docker compose --profile bootstrap run --rm directus-bootstrap

# optional: HTTPS on your own domain (set SITE_DOMAIN etc. in .env)
docker compose --profile proxy up -d
```

| URL | Service |
|---|---|
| `http://<host>:4321` | Public website |
| `http://<host>:4000/docs` | Catalog API (Swagger) |
| `http://<host>:8055` | Directus CMS admin |

---

## Live Deployments

- **Vercel (web only)**: [https://jubilee-square-v2.vercel.app](https://jubilee-square-v2.vercel.app). The web app
  still builds for Vercel; set `CATALOG_API_URL` there to point it at a running catalog API.
