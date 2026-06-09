#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR="${1:-./backups/$(date +%Y-%m)}"
mkdir -p "$BACKUP_DIR"
docker compose -f deploy/docker-compose.yml exec -T db pg_dump -U fixplease fixplease > "$BACKUP_DIR/fixplease.sql"
echo "Backup saved to $BACKUP_DIR/fixplease.sql"
