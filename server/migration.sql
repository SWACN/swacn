-- migration.sql
-- Incremental schema update

-- Add enterprise_email to track exactly which email was used to claim a seat
ALTER TABLE users ADD COLUMN IF NOT EXISTS enterprise_email VARCHAR(255) UNIQUE;
