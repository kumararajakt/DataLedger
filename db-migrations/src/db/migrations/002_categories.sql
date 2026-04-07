CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  icon TEXT DEFAULT '❓',
  is_system BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);

-- Prevent duplicate system category names
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_system_name
  ON categories(name) WHERE is_system = true AND user_id IS NULL;

-- Prevent duplicate custom category names per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_user_name
  ON categories(user_id, name) WHERE is_system = false;
