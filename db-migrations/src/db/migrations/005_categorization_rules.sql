CREATE TABLE IF NOT EXISTS categorization_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  priority INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_rules_user ON categorization_rules(user_id);
