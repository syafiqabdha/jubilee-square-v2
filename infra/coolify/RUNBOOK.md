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
- All REQUIRED secrets below present in the deployment environment. `docker-compose.yml` declares secrets with `${VAR:?}` and **no fallback**: a stack started without them fails immediately instead of booting on published credentials.

---

## 2. Required Environment & Secrets

Generate the secret values once per environment and store them in Coolify (or in a local `.env` for compose):

```bash
cp .env.example .env
printf 'DB_PASSWORD=%s\nADMIN_PASSWORD=%s\nKEY=%s\nSECRET=%s\n' \
  "$(openssl rand -hex 24)" "$(openssl rand -hex 24)" \
  "$(openssl rand -hex 32)" "$(openssl rand -hex 32)"
```

| Variable | Required | Notes |
|---|---|---|
| `DB_PASSWORD` | yes | Interpolated into the `postgresql://` URL — keep it URL-safe (no `@ : / ? #`). |
| `ADMIN_PASSWORD` | yes | Directus admin login, also used by `apps/directus/bootstrap.ts`. |
| `KEY` | yes | Directus token signing key. |
| `SECRET` | yes | Directus hashing/encryption secret. |
| `ADMIN_EMAIL`, `DB_USER`, `DB_NAME` | no | Non-secret defaults remain in `docker-compose.yml`. |

**Rotation caveat:** changing `KEY` or `SECRET` invalidates existing Directus sessions/tokens — rotate in a maintenance window and expect all users to log in again. Rotating `ADMIN_PASSWORD` also means updating the Directus admin user itself.

Pre-flight before every deployment:

```bash
./infra/coolify/check-envs.sh          # fails on missing, duplicate or placeholder secrets
```

---

## 3. Deployment Steps

### Step A: Run Automated Deployment
```bash
export COOLIFY_TOKEN="<your-token>"
export COOLIFY_URL="http://100.112.193.13:8000"
./infra/coolify/check-envs.sh   # must exit 0 before the deploy is triggered
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

## 4. Operations & Maintenance
- **Redeploy latest commit:** `./infra/coolify/redeploy.sh <APP_UUID>`
- **Check environment variables:** `./infra/coolify/check-envs.sh` — exits non-zero on missing/duplicate/placeholder secrets and validates the compose interpolation.
- **Run the test suite:** `npm test` from a clean checkout is self-sufficient — the root `pretest` hook builds the workspace packages (`@jubilee/shared`, `@jubilee/db`) that the test files import, so no manual `npm run build` is required first.
