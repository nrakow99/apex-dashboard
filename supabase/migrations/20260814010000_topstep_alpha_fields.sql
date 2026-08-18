-- Topstep + Alpha Futures support: new per-account rule-selection fields,
-- plus widening the firm constraint that 20260221120000_tradeify_program.sql
-- should have touched but didn't (accounts_firm_check was still 'Apex'/'Lucid'
-- only — Tradeify rows have been relying on either a manually-run ALTER or an
-- absent/disabled constraint in production; this migration is the tracked fix
-- either way, since DROP/ADD CONSTRAINT is idempotent regardless of current state).

alter table accounts
  drop constraint if exists accounts_firm_check;
alter table accounts
  add constraint accounts_firm_check
  check (firm in ('Apex', 'Lucid', 'Tradeify', 'Topstep', 'Alpha'));

-- Optional Daily Loss Limit election at checkout (Topstep today; Account.hasDailyLossLimit).
alter table accounts
  add column if not exists has_daily_loss_limit boolean not null default false;

-- Topstep XFA payout path — Standard vs Consistency (funded stage only; null pre-funding).
alter table accounts
  add column if not exists topstep_payout_path text;
alter table accounts
  drop constraint if exists accounts_topstep_payout_path_check;
alter table accounts
  add constraint accounts_topstep_payout_path_check
  check (topstep_payout_path is null or topstep_payout_path in ('standard', 'consistency'));

-- Alpha Futures tier — required for firm = 'Alpha' (getAccountRules throws without
-- it, by design — no safe default exists across tiers), null for every other firm.
alter table accounts
  add column if not exists alpha_tier text;
alter table accounts
  drop constraint if exists accounts_alpha_tier_check;
alter table accounts
  add constraint accounts_alpha_tier_check
  check (alpha_tier is null or alpha_tier in ('zero', 'standard', 'advanced'));
