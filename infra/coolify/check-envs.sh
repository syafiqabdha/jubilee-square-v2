#!/usr/bin/env bash
# Pre-flight check for the Jubilee Square v2 deployment environment.
#
#   ./infra/coolify/check-envs.sh [env-file]      # default: ./.env
#
# Exits non-zero when the environment file is missing, contains duplicate keys,
# leaves a REQUIRED secret empty, or still carries a published default/placeholder.
# docker-compose.yml declares every secret with `${VAR:?}` and no fallback, so this
# check mirrors exactly what the stack will refuse to start without.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${1:-$REPO_ROOT/.env}"
if [ -f "$ENV_FILE" ]; then
  ENV_FILE="$(cd "$(dirname "$ENV_FILE")" && pwd)/$(basename "$ENV_FILE")"
fi

fail() { echo "❌ $*" >&2; exit 1; }

[ -f "$ENV_FILE" ] || fail "$ENV_FILE not found. Run: cp .env.example .env — then fill in the REQUIRED values."

echo "🔍 Checking environment keys in $ENV_FILE..."

# 1. Duplicate keys — the first definition wins in dotenv parsing, so a stale value
#    earlier in the file silently shadows the intended one.
dups="$(awk -F= '/^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*=/{print $1}' "$ENV_FILE" | sort | uniq -d || true)"
if [ -n "$dups" ]; then
  while read -r dup; do echo "⚠️ Duplicate key found: $dup"; done <<< "$dups"
  fail "duplicate keys present in $ENV_FILE"
fi

# 2. Required secrets — no defaults exist anywhere in the repo.
#    DB_PASSWORD    → postgres service + catalog-api DATABASE_URL
#    ADMIN_EMAIL    → directus service + apps/directus bootstrap
#    ADMIN_PASSWORD → directus service + apps/directus bootstrap
#    KEY / SECRET   → directus service (token signing / encryption)
#    SYNC_SECRET    → catalog-api: POST /api/v1/sync requires the x-sync-secret header
REQUIRED_SECRETS=(DB_PASSWORD ADMIN_EMAIL ADMIN_PASSWORD KEY SECRET SYNC_SECRET)
# Values published in this repository/git history before the PAN-45 fixes, plus the
# placeholders people tend to leave behind. None of them may reach a deployment.
BANNED_VALUES=(
  "jubilee_secure_pass_2026"
  "JubileeAdmin2026!"
  "32-char-random-key-jubilee-sq-v2"
  "32-char-random-secret-jubilee-sq-v2"
  "change-me"
  "changeme"
  "CHANGEME"
  "example"
)

for key in "${REQUIRED_SECRETS[@]}"; do
  value="$(grep -E "^[[:space:]]*${key}=" "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)"
  value="${value%\"}"; value="${value#\"}"
  value="${value%\'}"; value="${value#\'}"

  if [ -z "$value" ]; then
    fail "$key is missing or empty — docker-compose.yml requires it (generate: openssl rand -base64 32)."
  fi
  for banned in "${BANNED_VALUES[@]}"; do
    if [ "$value" = "$banned" ]; then
      fail "$key still uses the published default/placeholder value '$banned' — rotate it before deploying."
    fi
  done
  if [ "${#value}" -lt 16 ]; then
    echo "⚠️ $key is shorter than 16 characters — consider openssl rand -base64 32."
  fi
  echo "   ✅ $key set (${#value} chars)"
done

# 3. Let docker compose itself confirm the interpolation resolves.
if command -v docker >/dev/null 2>&1; then
  echo "🔧 Validating docker compose interpolation..."
  if ! docker compose -f "$REPO_ROOT/docker-compose.yml" --env-file "$ENV_FILE" config --quiet; then
    fail "docker compose rejected $ENV_FILE (see the error above)."
  fi
  echo "   ✅ docker compose config accepted $ENV_FILE"
else
  echo "ℹ️ docker not available here — skipped the compose interpolation check."
fi

echo "✅ Environment check completed."
