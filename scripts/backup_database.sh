#!/bin/bash

# Database Backup Script for Proxmox Multi-Tenant Platform
# Runs daily via cron, keeps backups for 30 days

BACKUP_DIR="/var/backups/mysql/multpanel"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="multpanel"
DB_USER="multpanel"
DB_PASS="MultPanel2024!Secure"
RETENTION_DAYS=30
LOG_FILE="/var/log/mysql_backup.log"

# Logging function
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

log_message "Starting database backup..."

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Perform backup with compression
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${DATE}.sql.gz"
mysqldump -u $DB_USER -p$DB_PASS $DB_NAME --single-transaction --routines --triggers   | gzip > $BACKUP_FILE

# Check if backup succeeded
if [ $? -eq 0 ]; then
    BACKUP_SIZE=$(du -h $BACKUP_FILE | cut -f1)
    log_message "Backup successful: $(basename $BACKUP_FILE) ($BACKUP_SIZE)"
    
    # Create a 'latest' symlink
    ln -sf $BACKUP_FILE ${BACKUP_DIR}/latest.sql.gz
    
    # Clean up old backups (keep last 30 days)
    DELETED_COUNT=$(find $BACKUP_DIR -name "*.sql.gz" -mtime +$RETENTION_DAYS ! -name "latest.sql.gz" -delete -print | wc -l)
    if [ $DELETED_COUNT -gt 0 ]; then
        log_message "Cleaned up $DELETED_COUNT old backup(s)"
    fi
    
    # Log to activity_logs table
    mysql -u $DB_USER -p$DB_PASS $DB_NAME << SQL
        INSERT INTO activity_logs (
            user_id, company_id, activity_type, entity_type,
            action, description, status, metadata, created_at
        ) VALUES (
            NULL, NULL, 'system', 'database',
            'backup', 'Automated database backup completed',
            'success', 
            JSON_OBJECT(
                'filename', '$(basename $BACKUP_FILE)',
                'size', '$BACKUP_SIZE',
                'retention_days', $RETENTION_DAYS
            ),
            NOW()
        );
SQL
    
    log_message "Database backup completed successfully"
    exit 0
else
    log_message "ERROR: Backup failed!"
    
    # Log failure to database (if possible)
    mysql -u $DB_USER -p$DB_PASS $DB_NAME << SQL 2>/dev/null
        INSERT INTO activity_logs (
            user_id, company_id, activity_type, entity_type,
            action, description, status, created_at
        ) VALUES (
            NULL, NULL, 'system', 'database',
            'backup', 'Automated database backup failed', 'failed', NOW()
        );
SQL
    
    exit 1
fi
