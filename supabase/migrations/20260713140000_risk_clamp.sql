-- Risk Clamp per-account settings and trade log
-- One settings row per account; trades are append-only until cleared/reset.

CREATE TABLE IF NOT EXISTS risk_clamp_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  buffer NUMERIC(12, 2) NOT NULL DEFAULT 2000,
  stop_points NUMERIC(12, 2) NOT NULL DEFAULT 30,
  num_accounts INTEGER NOT NULL DEFAULT 1,
  family TEXT NOT NULL DEFAULT 'NQ',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id)
);

CREATE TABLE IF NOT EXISTS risk_clamp_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  trade_date DATE NOT NULL,
  family TEXT NOT NULL,
  stop_points NUMERIC(12, 2) NOT NULL,
  pnl NUMERIC(12, 2) NOT NULL,
  note TEXT,
  balance_after NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_clamp_settings_user_id ON risk_clamp_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_clamp_settings_account_id ON risk_clamp_settings(account_id);
CREATE INDEX IF NOT EXISTS idx_risk_clamp_trades_user_id ON risk_clamp_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_clamp_trades_account_id ON risk_clamp_trades(account_id);
CREATE INDEX IF NOT EXISTS idx_risk_clamp_trades_created_at ON risk_clamp_trades(created_at DESC);

ALTER TABLE risk_clamp_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_clamp_trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own risk clamp settings" ON risk_clamp_settings;
CREATE POLICY "Users can view their own risk clamp settings" ON risk_clamp_settings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own risk clamp settings" ON risk_clamp_settings;
CREATE POLICY "Users can insert their own risk clamp settings" ON risk_clamp_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own risk clamp settings" ON risk_clamp_settings;
CREATE POLICY "Users can update their own risk clamp settings" ON risk_clamp_settings
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own risk clamp settings" ON risk_clamp_settings;
CREATE POLICY "Users can delete their own risk clamp settings" ON risk_clamp_settings
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own risk clamp trades" ON risk_clamp_trades;
CREATE POLICY "Users can view their own risk clamp trades" ON risk_clamp_trades
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own risk clamp trades" ON risk_clamp_trades;
CREATE POLICY "Users can insert their own risk clamp trades" ON risk_clamp_trades
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own risk clamp trades" ON risk_clamp_trades;
CREATE POLICY "Users can update their own risk clamp trades" ON risk_clamp_trades
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own risk clamp trades" ON risk_clamp_trades;
CREATE POLICY "Users can delete their own risk clamp trades" ON risk_clamp_trades
  FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_risk_clamp_settings_updated_at ON risk_clamp_settings;
CREATE TRIGGER update_risk_clamp_settings_updated_at
  BEFORE UPDATE ON risk_clamp_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
