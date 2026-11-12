# Jubilee Square v2 — Docker Stack Deployment Runbook

The whole platform ships as one Docker Compose stack (`docker-compose.yml` at the repo root). The same file runs
on a plain VPS with `docker compose` or on Coolify with the *Docker Compose* build pack.

| Service | Image | Port (container → host) | Purpose |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | 5432 (internal only) | Catalog tables + Directus system tables |
| `directus` | `directus/directus:11.4.1` | 8055 → `DIRECTUS_PORT` | Headless CMS for tenants, deals, signage |
| `catalog-api` | built from `infra/docker/Dockerfile.api` | 3000 → `PORT` (4000) | Fastify REST API + signage feeds |
| `web` | built from `infra/docker/Dockerfile.web` | 4321 → `WEB_PORT` | Astro 7 SSR public site |
| `directus-schema` | `directus/directus:11.4.1` | — | One-shot, profile `bootstrap`: registers collections |
| `directus-bootstrap` | built from `infra/docker/Dockerfile.directus-bootstrap` | — | One-shot, profile `bootstrap`: permissions + sync Flow |
| `proxy` | `caddy:2-alpine` | 80, 443 | Optional, profile `proxy`: HTTPS with Let's Encrypt |

Images build from `package-lock.json` with `npm ci`, run as the unprivileged `node` user, carry their own
`HEALTHCHECK`, and only contain production dependencies. Container logs rotate at 10 MB × 3.

---

## 1. Required secrets

`docker-compose.yml` declares these with `${VAR:?}` and no fallback, so the stack refuses to start without them.
Generate each with `openssl rand -base64 32`.

| Variable | Used by |
|---|---|
| `DB_PASSWORD` | postgres, directus, catalog-api and web `DATABASE_URL` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | directus first-boot admin, `directus-bootstrap` |
| `KEY`, `SECRET` | directus token signing / encryption (changing them later logs everyone out) |
| `SYNC_SECRET` | catalog-api `POST /api/v1/sync`; written into the Directus sync Flow by the bootstrap |

Optional: `BIND_ADDR` (default `0.0.0.0`), `WEB_PORT`, `PORT`, `DIRECTUS_PORT`, `DIRECTUS_PUBLIC_URL`,
`DIRECTUS_CORS_ORIGIN`, and for the proxy `SITE_DOMAIN`, `CMS_DOMAIN`, `API_DOMAIN`, `ACME_EMAIL`.

Preflight before every deploy:

```bash
./infra/coolify/check-envs.sh .env   # non-zero on missing/duplicate/placeholder secrets, then validates compose
```

---

## 2. Plain VPS (Docker Engine + Compose v2)

```bash
git clone https://github.com/syafiqabdha/jubilee-square-v2.git && cd jubilee-square-v2
cp .env.example .env && ${EDITOR:-vi} .env
./infra/coolify/check-envs.sh .env

docker compose up -d --build
docker compose ps                    # all four services should report (healthy)

# First deploy only — register CMS collections, then grant permissions + install the sync Flow
docker compose --profile bootstrap run --rm directus-schema
docker compose --profile bootstrap run --rm directus-bootstrap
```

`directus-bootstrap` is safe to re-run. `directus-schema` is **not**: re-applying the snapshot to an
already-registered database fails on `tenant_amenities` (a junction table without a single-column primary key).

### HTTPS with the bundled proxy

Point DNS for `SITE_DOMAIN` (and `www.`), `CMS_DOMAIN` and `API_DOMAIN` at the host, then in `.env` set those
domains, `ACME_EMAIL`, and `BIND_ADDR=127.0.0.1` so the app ports are reachable only through Caddy:

```bash
docker compose --profile proxy up -d
```

### Updating

```bash
git pull && docker compose up -d --build
```

---

## 3. Coolify

1. Prerequisites: Coolify reachable (currently `http://100.112.193.13:8000` over Tailscale) and `COOLIFY_TOKEN`
   exported.
2. Add **every** required secret from §1 to the application's environment in Coolify. Keep one entry per key:
   duplicates silently shadow each other.
3. Create and deploy the application (Docker Compose build pack, `/docker-compose.yml`):

   ```bash
   export COOLIFY_TOKEN="<your-token>"
   ./infra/coolify/deploy.sh            # first time
   ./infra/coolify/redeploy.sh <APP_UUID>   # later
   ```

4. Assign domains to `web` (and optionally `directus`, `catalog-api`) in the Coolify UI. Coolify's own proxy
   handles TLS, so do not enable the `proxy` profile here.
5. First deploy only: run the two bootstrap one-shots from the server's terminal in the application directory
   (same commands as §2).

---

## 4. Verify

```bash
curl -fsS http://<host>:4321/ >/dev/null && echo web ok
curl -fsS http://<host>:4000/health
curl -fsS http://<host>:8055/server/health

# CMS → catalog sync contract. It fails closed and silently, so check it explicitly.
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://<host>:4000/api/v1/sync \
  -H "content-type: application/json" -H "x-sync-secret: $SYNC_SECRET" \
  -d '{"event":"items.update","collection":"tenants"}'
# 200 = wired correctly · 500 = SYNC_SECRET missing in catalog-api · 401 = header mismatch
```

Finally, edit a tenant in Directus and confirm the public site reflects it.

---

## 5. Operations

- **Backups:** `./infra/scripts/backup-db.sh` writes a gzipped `pg_dump` (catalog + CMS) to `backups/`. Schedule it
  with cron and copy the files off the host. Restore instructions are in the script header.
- **Logs:** `docker compose logs -f web catalog-api directus`
- **Placeholder images:** `python3 infra/scripts/generate-placeholders.py` creates a branded "Coming soon" image
  for any image path in the seed data that has no file yet. Replace a placeholder by dropping the real photo at the
  same path.
- **Tests:** `npm ci && npm test` from a clean checkout (the `pretest` hook builds workspaces in dependency order).

## 6. Vercel (web only)

The web app still builds for Vercel: `astro.config.mjs` switches to the Vercel adapter when `VERCEL` is set. On
Vercel, set `CATALOG_API_URL` to the public catalog API URL; without it the site serves the bundled seed catalog.
