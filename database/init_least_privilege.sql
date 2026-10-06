-- database/init_least_privilege.sql
-- ==============================================================================
-- Wello Production Least-Privilege MySQL User Architecture
-- ==============================================================================
-- Separates runtime application execution, database migrations, and backups
-- into 3 distinct privilege domains with cryptographic audit immutability.

-- 1. Create Dedicated Application User (Data Access Only, No DDL)
CREATE USER IF NOT EXISTS 'wello_app'@'%' IDENTIFIED BY 'REPLACE_WITH_STRONG_APP_PASSWORD_64_CHARS';

-- Grant DML privileges on general operational tables
GRANT SELECT, INSERT, UPDATE, DELETE ON `wello`.* TO 'wello_app'@'%';

-- Revoke UPDATE and DELETE specifically on immutable audit tables
REVOKE UPDATE, DELETE ON `wello`.`audit_logs` FROM 'wello_app'@'%';
REVOKE UPDATE, DELETE ON `wello`.`audit_anchor_logs` FROM 'wello_app'@'%';

-- Explicitly grant only INSERT and SELECT on audit tables
GRANT INSERT, SELECT ON `wello`.`audit_logs` TO 'wello_app'@'%';
GRANT INSERT, SELECT ON `wello`.`audit_anchor_logs` TO 'wello_app'@'%';

-- 2. Create Migration User (DDL & Schema Evolution Rights)
CREATE USER IF NOT EXISTS 'wello_migrator'@'%' IDENTIFIED BY 'REPLACE_WITH_STRONG_MIGRATOR_PASSWORD_64_CHARS';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES, TRIGGER ON `wello`.* TO 'wello_migrator'@'%';

-- 3. Create Backup & Disaster Recovery User (Read-Only Dump Rights)
CREATE USER IF NOT EXISTS 'wello_backup'@'%' IDENTIFIED BY 'REPLACE_WITH_STRONG_BACKUP_PASSWORD_64_CHARS';
GRANT SELECT, LOCK TABLES, SHOW VIEW, PROCESS ON *.* TO 'wello_backup'@'%';

-- Apply privilege updates immediately
FLUSH PRIVILEGES;
