#!/usr/bin/env bash
set -euo pipefail

COOLIFY_URL="${COOLIFY_URL:-http://100.112.193.13:8000}"
COOLIFY_TOKEN="${COOLIFY_TOKEN:-}"
APP_UUID="${1:-${APP_UUID:-}}"

if [ -z "$COOLIFY_TOKEN" ]; then
  echo "❌ Error: COOLIFY_TOKEN is required."
  exit 1
fi

if [ -z "$APP_UUID" ]; then
  echo "Usage: ./redeploy.sh <APP_UUID>"
  exit 1
fi

echo "🔄 Triggering redeploy for application $APP_UUID..."
curl -s -X POST "$COOLIFY_URL/api/v1/deploy?uuid=$APP_UUID&force=true" \
  -H "Authorization: Bearer $COOLIFY_TOKEN"
echo ""
echo "✅ Redeploy requested."
