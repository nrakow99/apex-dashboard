-- Tradeify firm + program (select_eval | select_flex | select_daily)
alter table accounts
  add column if not exists program text;

alter table accounts
  add column if not exists legacy_fifty_k_target boolean not null default false;
