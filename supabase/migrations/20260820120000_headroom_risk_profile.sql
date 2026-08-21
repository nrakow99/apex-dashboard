-- Headroom-in-trades: risk profile (contracts x stop ticks x tick value)
-- used to convert drawdown-remaining dollars into "N trades of room".
--
-- Ticks, not points, are the stored/computed unit — points aren't a natural
-- increment on every instrument (ES 0.25, CL 0.01), so storing points would
-- introduce rounding artifacts once multiplied through. The UI still
-- collects "stop, in points" where that's the trader's convention and
-- converts to ticks via instrument_specs.tick_size at save time.

-- Instrument specs: a single shared table. Rows with user_id null are the
-- built-in, exchange-sourced table (seeded below). Rows with a user_id are
-- either a trader's own added symbol or their override of a built-in they
-- believe is wrong — either way, a user row for a given symbol always wins
-- over the built-in row for the same symbol (see lib/instrument-specs.ts).
create table if not exists instrument_specs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  symbol text not null,
  label text not null,
  tick_size numeric not null check (tick_size > 0),
  tick_value numeric not null check (tick_value > 0),
  source text,
  created_at timestamptz not null default now()
);

-- Two partial unique indexes instead of one table-level UNIQUE, since a
-- table-level UNIQUE only accepts column names, not the
-- coalesce(user_id, ...) expression a single shared-uniqueness rule would
-- need. Same guarantee (one row per symbol per "owner", built-in or user),
-- no sentinel UUID.
create unique index if not exists instrument_specs_builtin_symbol_key
  on instrument_specs (symbol) where user_id is null;
create unique index if not exists instrument_specs_user_symbol_key
  on instrument_specs (user_id, symbol) where user_id is not null;

alter table instrument_specs enable row level security;

drop policy if exists "Built-ins and own instruments are readable" on instrument_specs;
create policy "Built-ins and own instruments are readable" on instrument_specs
  for select using (user_id is null or auth.uid() = user_id);

drop policy if exists "Users can insert their own instruments" on instrument_specs;
create policy "Users can insert their own instruments" on instrument_specs
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own instruments" on instrument_specs;
create policy "Users can update their own instruments" on instrument_specs
  for update using (auth.uid() = user_id);

drop policy if exists "Users can delete their own instruments" on instrument_specs;
create policy "Users can delete their own instruments" on instrument_specs
  for delete using (auth.uid() = user_id);

-- Built-in table: narrow and verified rather than broad and guessed. A
-- wrong tick value produces a wrong headroom number — same failure class as
-- a wrong rule value. Contract specs are set by the exchange and effectively
-- never change (unlike prop-firm rules), so a dated snapshot is enough; no
-- re-verification cadence needed. Sourced from CME Group's own contract
-- spec pages (cmegroup.com) for NQ/MNQ/ES/MES, cross-verified against
-- CME's published Micro E-mini FAQ and independent contract-spec references
-- (NinjaTrader, Barchart) for YM/MYM/RTY/M2K/CL/MCL/GC/MGC. Verified
-- 2026-08-20.
insert into instrument_specs (symbol, label, tick_size, tick_value, source)
values
  ('NQ', 'E-mini Nasdaq-100', 0.25, 5.00, 'CME Group contract specs, verified 2026-08-20'),
  ('MNQ', 'Micro E-mini Nasdaq-100', 0.25, 0.50, 'CME Group contract specs, verified 2026-08-20'),
  ('ES', 'E-mini S&P 500', 0.25, 12.50, 'CME Group contract specs, verified 2026-08-20'),
  ('MES', 'Micro E-mini S&P 500', 0.25, 1.25, 'CME Group contract specs, verified 2026-08-20'),
  ('YM', 'E-mini Dow ($5)', 1.00, 5.00, 'CME Group (CBOT) contract specs, verified 2026-08-20'),
  ('MYM', 'Micro E-mini Dow', 1.00, 0.50, 'CME Group (CBOT) contract specs, verified 2026-08-20'),
  ('RTY', 'E-mini Russell 2000', 0.10, 5.00, 'CME Group contract specs, verified 2026-08-20'),
  ('M2K', 'Micro E-mini Russell 2000', 0.10, 0.50, 'CME Group contract specs, verified 2026-08-20'),
  ('CL', 'Crude Oil (WTI)', 0.01, 10.00, 'CME Group (NYMEX) contract specs, verified 2026-08-20'),
  ('MCL', 'Micro WTI Crude Oil', 0.01, 1.00, 'CME Group (NYMEX) contract specs, verified 2026-08-20'),
  ('GC', 'Gold', 0.10, 10.00, 'CME Group (COMEX) contract specs, verified 2026-08-20'),
  ('MGC', 'Micro Gold', 0.10, 1.00, 'CME Group (COMEX) contract specs, verified 2026-08-20')
on conflict (symbol) where user_id is null do nothing;

-- User-level default risk profile (one instrument/size/stop most traders
-- run across every account). Per-account override lives on accounts below.
create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  risk_symbol text,
  risk_contracts integer check (risk_contracts is null or risk_contracts > 0),
  risk_stop_ticks integer check (risk_stop_ticks is null or risk_stop_ticks > 0),
  updated_at timestamptz not null default now()
);

alter table user_settings enable row level security;

drop policy if exists "Users can view their own settings" on user_settings;
create policy "Users can view their own settings" on user_settings
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own settings" on user_settings;
create policy "Users can insert their own settings" on user_settings
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own settings" on user_settings;
create policy "Users can update their own settings" on user_settings
  for update using (auth.uid() = user_id);

-- This helper originally lived only in scripts/001_create_tables.sql (a
-- one-shot bootstrap, never a tracked migration). Production DBs that
-- weren't bootstrapped from that script don't have it — create it here
-- rather than assuming it already exists.
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_user_settings_updated_at on user_settings;
create trigger update_user_settings_updated_at
  before update on user_settings
  for each row
  execute function update_updated_at_column();

-- Per-account override — all three or none (enforced in application code,
-- not a DB constraint, since "none" must remain a valid state meaning
-- "inherit the user default").
alter table accounts
  add column if not exists risk_symbol text,
  add column if not exists risk_contracts integer,
  add column if not exists risk_stop_ticks integer;

alter table accounts
  drop constraint if exists accounts_risk_contracts_check;
alter table accounts
  add constraint accounts_risk_contracts_check
  check (risk_contracts is null or risk_contracts > 0);

alter table accounts
  drop constraint if exists accounts_risk_stop_ticks_check;
alter table accounts
  add constraint accounts_risk_stop_ticks_check
  check (risk_stop_ticks is null or risk_stop_ticks > 0);
