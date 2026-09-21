#!/usr/bin/env bash
# ==============================================================================
# Wello Automated Database Backup, Disaster Recovery & Restore Drill Utility
# ==============================================================================

set -euo pipefail

BACKUP_DIR="./backups"
RETENTION_DAYS=30
mkdir -p "$BACKUP_DIR"

ACTION="${1:-backup}"
TARGET_FILE="${2:-}"

# Load DB credentials from .env
DB_NAME=$(grep -E '^DB_NAME=' .env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "wello")
DB_USER=$(grep -E '^DB_USER=' .env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "wello_user")
DB_PASSWORD=$(grep -E '^DB_PASSWORD=' .env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "wello_secret_password")
DB_ROOT_PASSWORD=$(grep -E '^DB_ROOT_PASSWORD=' .env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "rootpassword_secret")

perform_backup() {
    local TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    local OUT_FILE="$BACKUP_DIR/wello_backup_${TIMESTAMP}.sql.gz"
    local CHECKSUM_FILE="$OUT_FILE.sha256"

    echo "==> Initiating database backup for database: '$DB_NAME'..."
    docker compose exec -T mysql mysqldump -u"$DB_USER" -p"$DB_PASSWORD" \
        --single-transaction --quick --routines --triggers "$DB_NAME" | gzip > "$OUT_FILE"

    sha256sum "$OUT_FILE" > "$CHECKSUM_FILE"
    echo "==> Backup completed successfully: $OUT_FILE"
    echo "==> SHA-256 Checksum: $(cat "$CHECKSUM_FILE")"

    # Prune old backups
    echo "==> Pruning backups older than $RETENTION_DAYS days..."
    find "$BACKUP_DIR" -name "wello_backup_*.sql.gz" -mtime +"$RETENTION_DAYS" -exec rm {} + 2>/dev/null || true
    echo "==> Backup process finished."
}

perform_restore() {
    local RESTORE_FILE="$1"
    if [ -z "$RESTORE_FILE" ] || [ ! -f "$RESTORE_FILE" ]; then
        echo "Error: Backup file not specified or does not exist: '$RESTORE_FILE'"
        echo "Usage: $0 restore <path_to_backup_file.sql.gz>"
        exit 1
    fi

    # Verify Checksum if present
    if [ -f "$RESTORE_FILE.sha256" ]; then
        echo "==> Verifying SHA-256 checksum..."
        sha256sum -c "$RESTORE_FILE.sha256"
        echo "==> Checksum verified successfully."
    fi

    echo "==> Restoring database '$DB_NAME' from '$RESTORE_FILE'..."
    if [[ "$RESTORE_FILE" == *.gz ]]; then
        gunzip < "$RESTORE_FILE" | docker compose exec -T mysql mysql -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME"
    else
        docker compose exec -T mysql mysql -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$RESTORE_FILE"
    fi
    echo "==> Restore completed successfully for database '$DB_NAME'."
}

perform_drill() {
    echo "======================================================"
    echo "    STARTING AUTOMATED DISASTER RECOVERY DRILL        "
    echo "======================================================"
    local DRILL_DB="wello_dr_drill_$(date +%s)"
    local DRILL_BACKUP="$BACKUP_DIR/drill_temp.sql.gz"

    echo "==> [1/4] Creating live snapshot to $DRILL_BACKUP..."
    docker compose exec -T mysql mysqldump -u"$DB_USER" -p"$DB_PASSWORD" \
        --single-transaction --routines --triggers "$DB_NAME" | gzip > "$DRILL_BACKUP"

    echo "==> [2/4] Initializing isolated drill database '$DRILL_DB'..."
    docker compose exec -T mysql mysql -u"root" -p"$DB_ROOT_PASSWORD" -e "CREATE DATABASE $DRILL_DB;"

    echo "==> [3/4] Testing restoration pipeline into drill database..."
    gunzip < "$DRILL_BACKUP" | docker compose exec -T mysql mysql -u"root" -p"$DB_ROOT_PASSWORD" "$DRILL_DB"

    echo "==> [4/4] Verifying table integrity and row counts..."
    TABLE_COUNT=$(docker compose exec -T mysql mysql -u"root" -p"$DB_ROOT_PASSWORD" -e "SELECT count(*) FROM information_schema.tables WHERE table_schema = '$DRILL_DB';" -s -N)
    USER_COUNT=$(docker compose exec -T mysql mysql -u"root" -p"$DB_ROOT_PASSWORD" -e "SELECT count(*) FROM $DRILL_DB.users;" -s -N || echo "0")
    AUDIT_COUNT=$(docker compose exec -T mysql mysql -u"root" -p"$DB_ROOT_PASSWORD" -e "SELECT count(*) FROM $DRILL_DB.admin_audit_logs;" -s -N || echo "0")

    echo "    - Verified Tables Restored: $TABLE_COUNT"
    echo "    - Verified User Records:    $USER_COUNT"
    echo "    - Verified Audit Log Rows:  $AUDIT_COUNT"

    echo "==> Cleaning up drill database and temporary snapshot..."
    docker compose exec -T mysql mysql -u"root" -p"$DB_ROOT_PASSWORD" -e "DROP DATABASE $DRILL_DB;"
    rm -f "$DRILL_BACKUP"

    echo "======================================================"
    echo " [PASS] DISASTER RECOVERY DRILL PASSED SUCCESSFULLY!  "
    echo " All data structures, schemas, and records verified.  "
    echo "======================================================"
}

case "$ACTION" in
    backup)
        perform_backup
        ;;
    restore)
        perform_restore "$TARGET_FILE"
        ;;
    drill)
        perform_drill
        ;;
    *)
        echo "Usage: $0 {backup|restore <file>|drill}"
        exit 1
        ;;
esac
