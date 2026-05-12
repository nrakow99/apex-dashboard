-- Add drawdown_type column to accounts table
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS drawdown_type TEXT NOT NULL DEFAULT 'EOD'
    CHECK (drawdown_type IN ('EOD', 'INTRADAY'));
