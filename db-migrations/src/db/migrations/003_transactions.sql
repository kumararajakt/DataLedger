CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  type TEXT CHECK (type IN ('income', 'expense', 'transfer')),
  source TEXT CHECK (source IN ('csv', 'pdf', 'manual', 'plaid')) DEFAULT 'manual',
  hash TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(user_id, hash);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'transactions'
    AND policyname = 'transactions_user_policy'
  ) THEN
    CREATE POLICY transactions_user_policy ON transactions
      USING (user_id = current_setting('app.current_user_id', true)::UUID);
  END IF;
END
$$;
