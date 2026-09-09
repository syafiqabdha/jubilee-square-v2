# Jubilee Square v2 — Coolify & Docker Compose Runbook

## Overview
Full-stack production deployment for Jubilee Square v2 consisting of:
1. **PostgreSQL 16**: Relational data store and migrations.
2. **Directus 11**: Headless CMS for tenant management.
3. **Catalog API (Fastify)**: High-speed read-optimized REST API & digital signage feeds.
4. **Web App (Astro 5 SSR)**: Mobile-first directory, category filters, and legacy ASPX 301 redirects.

---

## 1. Prerequisites
- Remote GitHub repository: `https://github.com/syafiqabdha/jubilee-square-v2`
- Coolify instance at `http://100.112.193.13:8000` (accessible via Tailscale).
- `COOLIFY_TOKEN` exported in shell environment.

---

## 2. Deployment Steps

### Step A: Run Automated Deployment
```bash
export COOLIFY_TOKEN="<your-token>"
export COOLIFY_URL="http://100.112.193.13:8000"
./infra/coolify/deploy.sh
```

### Step B: Post-Deployment Verification
Verify all health check endpoints return HTTP 200:
- Web App: `http://<host>:4321/`
- Catalog API: `http://<host>:3000/health`
- Directus CMS: `http://<host>:8055/server/health`

### Step C: Seed CMS Collections (First Deploy Only)
```bash
npm run test --workspace=@jubilee/directus
```

---

## 3. Operations & Maintenance
- **Redeploy latest commit:** `./infra/coolify/redeploy.sh <APP_UUID>`
- **Check environment variables:** `./infra/coolify/check-envs.sh`
