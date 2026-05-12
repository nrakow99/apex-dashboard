-- Links a passed Eval account to the Performance Account created via “Activate PA”.
alter table public.accounts
  add column if not exists activated_pa_account_id uuid references public.accounts (id) on delete set null,
  add column if not exists activated_at timestamptz;

comment on column public.accounts.activated_pa_account_id is 'PA account created from this Eval via Activate PA';
comment on column public.accounts.activated_at is 'When the Eval was activated into the linked PA';

create index if not exists accounts_activated_pa_account_id_idx on public.accounts (activated_pa_account_id);
