#!/usr/bin/env bash
set -euo pipefail

# Configuration
COOLIFY_URL="${COOLIFY_URL:-http://100.112.193.13:8000}"
COOLIFY_TOKEN="${COOLIFY_TOKEN:-}"
PROJECT_UUID="${PROJECT_UUID:-llsdc8bggllvk6wimhpu8ieo}"
ENVIRONMENT_NAME="${ENVIRONMENT_NAME:-production}"
DESTINATION_UUID="${DESTINATION_UUID:-vt0hxevs3zjopd1yc34uqmgu}"
SERVER_UUID="${SERVER_UUID:-3v3fregydeydkjbkmcp0fbtn}"
GIT_REPO="${GIT_REPO:-https://github.com/syafiqabdha/jubilee-square-v2.git}"
GIT_BRANCH="${GIT_BRANCH:-main}"

if [ -z "$COOLIFY_TOKEN" ]; then
  echo "❌ Error: COOLIFY_TOKEN environment variable is not set."
  exit 1
fi

echo "🚀 Deploying Jubilee Square v2 to Coolify ($COOLIFY_URL)..."

# 1. Create Docker Compose Application via Public Repo API
echo "📦 Creating/registering application on Coolify..."
CREATE_RES=$(curl -s -X POST "$COOLIFY_URL/api/v1/applications/public" \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"project_uuid\": \"$PROJECT_UUID\",
    \"environment_name\": \"$ENVIRONMENT_NAME\",
    \"destination_uuid\": \"$DESTINATION_UUID\",
    \"server_uuid\": \"$SERVER_UUID\",
    \"git_repository\": \"$GIT_REPO\",
    \"git_branch\": \"$GIT_BRANCH\",
    \"build_pack\": \"dockercompose\",
    \"docker_compose_location\": \"/docker-compose.yml\",
    \"name\": \"Jubilee Square v2\",
    \"description\": \"Full-stack Docker Compose monorepo for Jubilee Square\"
  }")

APP_UUID=$(echo "$CREATE_RES" | grep -o '"uuid":"[^"]*"' | head -n1 | cut -d'"' -f4 || echo "")

if [ -z "$APP_UUID" ]; then
  echo "⚠️ Application may already exist or returned response:"
  echo "$CREATE_RES"
else
  echo "✅ Application created with UUID: $APP_UUID"
fi

# 2. Trigger deployment if APP_UUID obtained
if [ -n "$APP_UUID" ]; then
  echo "🚀 Triggering deployment build..."
  DEPLOY_RES=$(curl -s -X POST "$COOLIFY_URL/api/v1/deploy?uuid=$APP_UUID" \
    -H "Authorization: Bearer $COOLIFY_TOKEN")
  echo "Deployment initiated: $DEPLOY_RES"
fi

echo "✨ Deployment script finished."
