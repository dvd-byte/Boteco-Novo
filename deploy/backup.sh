#!/bin/bash
set -euo pipefail
umask 077
# Credentials belong in /etc/boteco/backup.cnf, mode 600, [client] section.
: "${BACKUP_DIR:=/var/backups/boteco}"
: "${DB_NAME:=boteco}"
: "${UPLOAD_DIR:=/var/lib/boteco/uploads}"
[[ "$DB_NAME" =~ ^[a-zA-Z0-9_]+$ ]] || exit 2
mkdir -p "$BACKUP_DIR"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
staging=$(mktemp -d "$BACKUP_DIR/.pending.XXXXXX")
trap 'rm -f -- "$staging/database.sql.gz" "$staging/uploads.tar.gz" "$staging/SHA256SUMS"; rmdir -- "$staging" 2>/dev/null || true' EXIT
mariadb-dump --defaults-extra-file=/etc/boteco/backup.cnf --single-transaction --routines --events --triggers "$DB_NAME" | gzip > "$staging/database.sql.gz"
tar -czf "$staging/uploads.tar.gz" -C "$UPLOAD_DIR" .
(cd "$staging" && sha256sum database.sql.gz uploads.tar.gz > SHA256SUMS)
mv -- "$staging" "$BACKUP_DIR/$stamp"
# Retention is intentionally manual until the operator defines its policy.
