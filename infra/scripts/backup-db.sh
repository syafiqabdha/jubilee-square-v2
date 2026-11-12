#!/usr/bin/env bash
# Dump the Jubilee Square Postgres database (catalog tables + Directus) to ./backups.
#
#   ./infra/scripts/backup-db.sh                 # writes backups/jubilee-<timestamp>.sql.gz
#   gunzip -c backups/<file>.sql.gz | docker exec -i jubilee-postgres psql -U "$DB_USER" -d "$DB_NAME"   # restore
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.."
[ -f .env ] && { set -a; . ./.env; set +a; }

DB_USER="${DB_USER:-jubilee_admin}"
DB_NAME="${DB_NAME:-jubilee_square_v2}"
CONTAINER="${PG_CONTAINER:-jubilee-postgres}"
OUT_DIR="${BACKUP_DIR:-backups}"
mkdir -p "$OUT_DIR"
FILE="$OUT_DIR/jubilee-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"

docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --clean --if-exists | gzip > "$FILE"
echo "✅ Backup written to $FILE ($(du -h "$FILE" | cut -f1))"
