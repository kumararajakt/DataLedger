-- Migration 007: AI integration settings per user
CREATE TABLE IF NOT EXISTS user_ai_settings (
  user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled    BOOLEAN NOT NULL DEFAULT false,
  provider   TEXT    NOT NULL DEFAULT 'openai',   -- 'anthropic' | 'openai' | 'openrouter' | 'local'
  base_url   TEXT,
  api_key    TEXT,                                 -- AES-256-GCM encrypted
  model      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
