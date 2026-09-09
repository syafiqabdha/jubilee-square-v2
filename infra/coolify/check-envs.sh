#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "⚠️ Warning: $ENV_FILE not found. Checking .env.example..."
  ENV_FILE=".env.example"
fi

echo "🔍 Checking environment keys in $ENV_FILE..."
awk -F= '{print $1}' "$ENV_FILE" | grep -v '^#' | grep -v '^$' | sort | uniq -d | while read -r dup; do
  echo "⚠️ Duplicate key found: $dup"
done

echo "✅ Environment check completed."
