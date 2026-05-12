-- Migration 003: Add firm, account_size; normalize drawdown_type casing; add payout split tracking

-- Fix drawdown_type constraint: rename INTRADAY → Intraday to match spec
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_drawdown_type_check;
UPDATE accounts SET drawdown_type = 'Intraday' WHERE drawdown_type = 'INTRADAY';
ALTER TABLE accounts ADD CONSTRAINT accounts_drawdown_type_check
  CHECK (drawdown_type IN ('EOD', 'Intraday'));

-- Add firm column (default Apex for all existing rows)
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS firm TEXT NOT NULL DEFAULT 'Apex';
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_firm_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_firm_check CHECK (firm IN ('Apex', 'Lucid'));

-- Add account_size column (default 50000 for all existing rows)
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_size NUMERIC NOT NULL DEFAULT 50000;

-- Add payout split tracking columns (nullable so existing rows are unaffected)
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS trader_received NUMERIC;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS firm_split NUMERIC;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS payout_split_percent NUMERIC;
