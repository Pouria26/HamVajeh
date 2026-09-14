#!/usr/bin/env bash
# HamVajeh PostgreSQL Restore Script (Linux VPS / Server)
# Usage: ./docker/scripts/restore.sh <path_to_backup_file.sql.gz>

set -euo pipefail

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <path_to_backup_file.sql.gz>"
    echo "Example: $0 docker/backups/hamvajeh_backup_20260914_124603.sql.gz"
    exit 1
fi

BACKUP_FILE="$1"
CONTAINER_NAME="${POSTGRES_CONTAINER:-hamvajeh-postgres-prod}"
DB_USER="${POSTGRES_USER:-hamvajeh}"
DB_NAME="${POSTGRES_DB:-hamvajeh}"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "ERROR: Backup file '${BACKUP_FILE}' does not exist!" >&2
    exit 1
fi

echo "WARNING: This will restore database '${DB_NAME}' from '${BACKUP_FILE}'."
read -p "Are you sure you want to proceed? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Restore aborted by user."
    exit 0
fi

echo "Restoring database from ${BACKUP_FILE}..."
if [[ "${BACKUP_FILE}" == *.gz ]]; then
    gzip -dc "${BACKUP_FILE}" | docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}"
else
    docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" < "${BACKUP_FILE}"
fi

echo "Restore completed successfully!"
