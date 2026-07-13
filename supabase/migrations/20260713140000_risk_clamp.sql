-- Risk Clamp per-account settings and trade log
-- Private dashboard version: no user_id / no auth.uid() / no RLS

DROP TABLE IF EXISTS risk_clamp_trades CASCADE;
DROP TABLE IF EXISTS risk_clamp_settings CASCADE;

CREATE TABLE risk_clamp_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  buffer NUMERIC(12, 2) NOT NULL DEFAULT 2000,
  stop_points NUMERIC(12, 2) NOT NULL DEFAULT 30,
  num_accounts INTEGER NOT NULL DEFAULT 1,
  family TEXT NOT NULL DEFAULT 'NQ',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT risk_clamp_settings_account_unique UNIQUE (account_id),
  CONSTRAINT risk_clamp_settings_family_check CHECK (family IN ('NQ', 'ES')),
  CONSTRAINT risk_clamp_settings_num_accounts_check CHECK (num_accounts >= 1)
);

CREATE TABLE risk_clamp_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  trade_date DATE NOT NULL DEFAULT CURRENT_DATE,
  family TEXT NOT NULL,
  stop_points NUMERIC(12, 2) NOT NULL,
  pnl NUMERIC(12, 2) NOT NULL,
  note TEXT,
  balance_after NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT risk_clamp_trades_family_check CHECK (family IN ('NQ', 'ES'))
);

CREATE INDEX idx_risk_clamp_settings_account_id
ON risk_clamp_settings(account_id);

CREATE INDEX idx_risk_clamp_trades_account_id
ON risk_clamp_trades(account_id);

CREATE INDEX idx_risk_clamp_trades_created_at
ON risk_clamp_trades(created_at DESC);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_risk_clamp_settings_updated_at
ON risk_clamp_settings;

CREATE TRIGGER update_risk_clamp_settings_updated_at
BEFORE UPDATE ON risk_clamp_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();