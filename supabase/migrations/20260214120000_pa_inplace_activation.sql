-- Eval → PA in-place: drop separate linked PA; add PA metric window and audit fields.

alter table public.accounts drop constraint if exists accounts_activated_pa_account_id_fkey;
drop index if exists accounts_activated_pa_account_id_idx;
alter table public.accounts drop column if exists activated_pa_account_id;

alter table public.accounts add column if not exists activation_start_date date;
alter table public.accounts add column if not exists previous_type text;
alter table public.accounts add column if not exists activated_at timestamptz;

comment on column public.accounts.activation_start_date is
  'PA metrics (stats, payouts, eligibility) use trades and payouts on or after this date only.';
comment on column public.accounts.previous_type is 'Account type before in-place conversion (e.g. Eval).';
comment on column public.accounts.activated_at is 'When the account was converted to PA in-app.';
