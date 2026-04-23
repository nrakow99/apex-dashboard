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
