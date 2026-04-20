-- Make password_hash nullable to support Google-only accounts
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Add google_id for OAuth login
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;
