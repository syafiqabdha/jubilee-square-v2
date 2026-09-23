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
- `SYNC_SECRET` exported in the bootstrap operator's shell environment (required for Directus Flow sync setup). Note: The `docker-compose.yml` file restricts booting all services unless it is set. If following `.env.example`, the default value is intentionally blank and will hard-stop deployment until a generated secret is provided.

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

Then confirm the CMS → API sync path end to end. It fails closed *and* silently, so three green health checks do not
prove it works:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://<host>:3000/api/v1/sync \
  -H "content-type: application/json" \
  -H "x-sync-secret: $SYNC_SECRET" \
  -d '{"event":"items.update","collection":"tenants"}'
# 200 = secret and Directus flow are wired correctly
# 500 = SYNC_SECRET is not set in the catalog-api container
# 401 = the flow's x-sync-secret header does not match the container value
```

Finally, edit a tenant in the CMS and confirm the public catalog reflects it. That is the only check that covers the
Directus half of the contract.

### Step C: Seed CMS Collections (First Deploy Only)
The snapshot lives at `apps/directus/schema.snapshot.json` (there is no copy at the repo root), Postgres is not
published to the host (`5432` is `expose`-only) and the repo pins no `directus` CLI — so run the **pinned** CLI that
ships inside the Directus container, against the database on the compose network:

```bash
# from the repo root, after the stack is up (Step B)
docker cp apps/directus/schema.snapshot.json jubilee-directus:/tmp/schema.snapshot.json
docker exec -w /directus jubilee-directus \
  node node_modules/@directus/api/dist/cli/run.js schema apply /tmp/schema.snapshot.json --yes
npm run test --workspace=@jubilee/directus
```

Expect `Snapshot applied successfully` and 7 registered collections. Before this apply the Directus Collections UI is
empty (the domain tables arrive as raw SQL from `infra/migrations/001_init.sql` and are invisible to Directus), so
the event-driven sync flow cannot fire yet.

---

## 3. Operations & Maintenance
- **Redeploy latest commit:** `./infra/coolify/redeploy.sh <APP_UUID>`
- **Check environment variables:** `./infra/coolify/check-envs.sh`
