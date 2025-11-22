-- Migration: Add username field to users table
-- Date: 2025-08-09
-- Description: Adds required username field for authentication system

-- Add username column with temporary default
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50) NOT NULL DEFAULT '';

-- Update existing users with unique usernames based on their ID
-- This gives each existing user a temporary username they can change later
UPDATE users SET username = CONCAT('user_', id) WHERE username = '';

-- Remove the default constraint after populating existing rows
ALTER TABLE users ALTER COLUMN username DROP DEFAULT;

-- Add unique constraint on username
ALTER TABLE users ADD CONSTRAINT uq_users_username UNIQUE (username);

-- Create index for faster username lookups during authentication
CREATE INDEX IF NOT EXISTS ix_users_username ON users(username);

-- Rollback script (save separately)
-- DROP INDEX IF EXISTS ix_users_username;
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS uq_users_username;
-- ALTER TABLE users DROP COLUMN IF EXISTS username;