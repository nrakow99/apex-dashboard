-- Optional manual overrides for intraday trailing floor / drawdown remaining (Tradovate-synced).
alter table public.accounts
  add column if not exists manual_intraday_floor numeric,
  add column if not exists manual_drawdown_remaining numeric,
  add column if not exists manual_drawdown_updated_at timestamptz;

comment on column public.accounts.manual_intraday_floor is 'User-entered active floor when intraday drawdown cannot be derived from closed trades alone';
comment on column public.accounts.manual_drawdown_remaining is 'User-entered distance to intraday floor';
comment on column public.accounts.manual_drawdown_updated_at is 'When manual intraday drawdown values were last saved';
