#!/bin/bash
# ══════════════════════════════════════════════════════════
# LMS Database Backup Script
# ══════════════════════════════════════════════════════════
# Usage: ./scripts/backup-db.sh
# Cron:  0 3 * * * /path/to/scripts/backup-db.sh >> /var/log/lms-backup.log 2>&1
# ══════════════════════════════════════════════════════════

set -euo pipefail

# ── Configuration ────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_CONTAINER="${DB_CONTAINER:-m-dulo-lms-db-1}"
DB_NAME="${DB_NAME:-lms_db}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-lms_root_change_me}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# ── Create backup directory ──────────────────────────────
mkdir -p "$BACKUP_DIR"

# ── Generate filename with timestamp ─────────────────────
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="lms_backup_${TIMESTAMP}.sql.gz"
FILEPATH="${BACKUP_DIR}/${FILENAME}"

echo "═══════════════════════════════════════════"
echo "📦 LMS Database Backup"
echo "═══════════════════════════════════════════"
echo "🕐 Started: $(date)"
echo "📁 Output:  ${FILEPATH}"

# ── Dump and compress ────────────────────────────────────
docker exec "$DB_CONTAINER" \
  mariadb-dump \
    --user="$DB_USER" \
    --password="$DB_PASSWORD" \
    --single-transaction \
    --routines \
    --triggers \
    --quick \
    "$DB_NAME" | gzip > "$FILEPATH"

# ── Verify backup ───────────────────────────────────────
FILESIZE=$(du -h "$FILEPATH" | cut -f1)
echo "✅ Backup complete: ${FILENAME} (${FILESIZE})"

# ── Cleanup old backups ─────────────────────────────────
DELETED=$(find "$BACKUP_DIR" -name "lms_backup_*.sql.gz" -mtime +${RETENTION_DAYS} -delete -print | wc -l)
if [ "$DELETED" -gt 0 ]; then
  echo "🗑️  Deleted ${DELETED} backups older than ${RETENTION_DAYS} days"
fi

echo "🕐 Finished: $(date)"
echo "═══════════════════════════════════════════"
