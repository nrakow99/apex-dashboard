-- Product-tour records must never blend into real account decisions.
alter table public.accounts
  add column if not exists is_demo boolean not null default false;

-- Backfill the existing demo workspace once. Future identity is column-backed
-- and cannot be changed by renaming an account.
update public.accounts
set is_demo = true
where is_demo = false and name like 'DEMO ·%';

create index if not exists accounts_user_demo_idx
  on public.accounts (user_id, is_demo, created_at);
