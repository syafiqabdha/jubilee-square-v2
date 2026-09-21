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
- **Every REQUIRED secret below injected into the Coolify application environment.** `docker-compose.yml` uses
  required-variable syntax (`${VAR:?}`) with no fallback, so a deploy missing any of them fails immediately instead
  of booting on a well-known demo credential.

---

## 2. Required Environment & Secrets

| Variable | Required | Consumed by |
|---|---|---|
| `DB_PASSWORD` | yes | `postgres` service and the catalog-api `DATABASE_URL` |
| `ADMIN_EMAIL` | yes | `directus` service and `apps/directus/bootstrap.ts` |
| `ADMIN_PASSWORD` | yes | `directus` service and `apps/directus/bootstrap.ts` |
| `KEY` | yes | Directus token signing |
| `SECRET` | yes | Directus hashing / encryption |
| `SYNC_SECRET` | yes | catalog-api: `POST /api/v1/sync` requires a matching `x-sync-secret` header |
| `DB_USER`, `DB_NAME`, port vars | no | Non-secret defaults remain in `docker-compose.yml` |

Generate values once per environment and store them in Coolify (or a local `.env` for compose):

```bash
cp .env.example .env
# fill the REQUIRED keys, then validate:
./infra/coolify/check-envs.sh
```

**Rotation caveats.** Changing `KEY` or `SECRET` invalidates existing Directus sessions/tokens — rotate in a
maintenance window and expect every CMS user to log in again. Rotating `ADMIN_PASSWORD` also means updating the
Directus admin user itself. The values that were committed to this repository before the PAN-45 hardening
(`jubilee_secure_pass_2026`, `JubileeAdmin2026!`, `32-char-random-…`) are *published* — removing the defaults from
the code does not un-publish them, so they must be rotated on the host.

Pre-flight before every deployment:

```bash
./infra/coolify/check-envs.sh          # fails on missing, duplicate, placeholder or stale-published secrets
```

It exits non-zero before Coolify is ever contacted, and finishes by re-running `docker compose config` so the
interpolation is proven to resolve.

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

Then confirm the CMS sync webhook is accepted (not 401/500):

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://<host>:3000/api/v1/sync \
  -H "content-type: application/json" \
  -H "x-sync-secret: $SYNC_SECRET" \
  -d '{"event":"items.update","collection":"tenants"}'
# expect 200 — a 500 means SYNC_SECRET is not set in the running container,
# a 401 means the Directus flow header does not match it.
```

### Step C: Seed CMS Collections (First Deploy Only)
```bash
npm run test --workspace=@jubilee/directus
```

---

## 4. Sync Webhook Authentication (Directus → catalog-api)

`POST /api/v1/sync` is closed by a shared secret. `apps/catalog-api/src/routes/sync.ts` reads `SYNC_SECRET` at
request time and fails closed: a missing variable returns **500**, a missing or mismatched `x-sync-secret` header
returns **401**. Because it fails closed, a CMS whose webhook does not send the header stops updating the public
catalog *silently* — the endpoint keeps returning errors to nobody.

The Directus flow that calls the webhook is **not** kept in this repository (the schema snapshot carries no flows),
so it must be configured in the Directus UI:

1. Add `SYNC_SECRET` to the Directus container environment **and** to `FLOWS_ENV_ALLOW_LIST`
   (Directus only exposes allow-listed variables to flows — see the Directus flows documentation), or paste the
   secret directly into the flow's header value.
2. In the flow's Webhook operation, add the header `x-sync-secret: {{$env.SYNC_SECRET}}`.
3. Re-run the Step B curl above, then edit a tenant in the CMS and confirm the catalog reflects it.

---

## 5. Operations & Maintenance
- **Redeploy latest commit:** `./infra/coolify/redeploy.sh <APP_UUID>`
- **Check environment variables:** `./infra/coolify/check-envs.sh` — exits non-zero on missing/duplicate/placeholder
  secrets and validates the compose interpolation.
- **Run the test suite:** `npm test` from a clean checkout is self-sufficient — the root `pretest` hook builds the
  workspace packages (`@jubilee/shared`, `@jubilee/db`) that the test files import, so no manual `npm run build` is
  required first. Cold-clone order for a release check: `npm ci` → `npm test` (cold, exit 0) → `npm run build` →
  `npm test` (113/113) → `npm run typecheck`.
