-- migration.sql

BEGIN;

ALTER TABLE users
DROP COLUMN internet_quota_bytes,
DROP COLUMN quota_reset_date;

COMMIT;
