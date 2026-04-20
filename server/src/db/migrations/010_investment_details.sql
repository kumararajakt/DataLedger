ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS investment_details JSONB;

CREATE INDEX IF NOT EXISTS idx_transactions_investment_details
  ON transactions USING GIN (investment_details)
  WHERE investment_details IS NOT NULL;
