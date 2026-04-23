-- Create accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Eval', 'PA', 'Live')),
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Passed', 'Failed')),
  starting_balance DECIMAL(12, 2) NOT NULL,
  max_drawdown DECIMAL(12, 2) NOT NULL DEFAULT 2000,
  daily_loss_limit DECIMAL(12, 2) DEFAULT 1000,
  profit_target DECIMAL(12, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create trades table
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  symbol TEXT NOT NULL,
  pnl DECIMAL(12, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create payouts table
CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  payout_number INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_account_id ON trades(account_id);
CREATE INDEX IF NOT EXISTS idx_trades_date ON trades(date);
CREATE INDEX IF NOT EXISTS idx_payouts_user_id ON payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_account_id ON payouts(account_id);

-- Enable Row Level Security
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for accounts
CREATE POLICY "Users can view their own accounts" ON accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own accounts" ON accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own accounts" ON accounts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own accounts" ON accounts
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for trades
CREATE POLICY "Users can view their own trades" ON trades
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trades" ON trades
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trades" ON trades
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trades" ON trades
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for payouts
CREATE POLICY "Users can view their own payouts" ON payouts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payouts" ON payouts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payouts" ON payouts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own payouts" ON payouts
  FOR DELETE USING (auth.uid() = user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for accounts updated_at
DROP TRIGGER IF EXISTS update_accounts_updated_at ON accounts;
CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
