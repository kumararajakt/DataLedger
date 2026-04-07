CREATE TABLE IF NOT EXISTS monthly_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  total_income NUMERIC(12, 2) DEFAULT 0,
  total_expense NUMERIC(12, 2) DEFAULT 0,
  by_category JSONB DEFAULT '{}',
  UNIQUE(user_id, month)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_user_month ON monthly_snapshots(user_id, month DESC);
