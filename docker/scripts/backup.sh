#!/usr/bin/env bash
# HamVajeh PostgreSQL Automated Backup Script (Linux VPS / Server)
# Usage: ./docker/scripts/backup.sh
# Can be scheduled via crontab (e.g. daily at 02:00 AM):
# 0 2 * * * /path/to/project/docker/scripts/backup.sh >> /path/to/project/docker/backups/backup.log 2>&1

set -euo pipefail

# Script directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BACKUP_DIR="${PROJECT_ROOT}/docker/backups"

# Configuration
CONTAINER_NAME="${POSTGRES_CONTAINER:-hamvajeh-postgres-prod}"
DB_USER="${POSTGRES_USER:-hamvajeh}"
DB_NAME="${POSTGRES_DB:-hamvajeh}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
BACKUP_FILE="${BACKUP_DIR}/hamvajeh_backup_${TIMESTAMP}.sql.gz"

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Starting database backup for '${DB_NAME}' from container '${CONTAINER_NAME}'..."

# Verify container is running
if ! docker ps --format '{{.Names}}' | grep -Eq "^${CONTAINER_NAME}\$"; then
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] ERROR: Container '${CONTAINER_NAME}' is not running!" >&2
    exit 1
fi

# Execute pg_dump inside container and compress with gzip
docker exec "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists | gzip -9 > "${BACKUP_FILE}"

FILE_SIZE="$(du -h "${BACKUP_FILE}" | cut -f1)"
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Backup successful: ${BACKUP_FILE} (${FILE_SIZE})"

# Remove backups older than retention days
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Pruning backups older than ${RETENTION_DAYS} days in ${BACKUP_DIR}..."
find "${BACKUP_DIR}" -name "hamvajeh_backup_*.sql.gz" -type f -mtime +"${RETENTION_DAYS}" -delete

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Backup and retention cleanup completed successfully."
