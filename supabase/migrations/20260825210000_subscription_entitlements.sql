-- Server-owned product entitlements. This migration contains commercial
-- limits only; it never stores or changes prop-firm rule values.

create table if not exists public.user_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null,
  status text not null,
  account_limit integer,
  screenshot_monthly_limit integer not null,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_entitlements_tier_check check (
    tier in ('starter', 'pro', 'desk', 'founding')
  ),
  constraint user_entitlements_status_check check (
    status in ('trialing', 'active', 'past_due', 'canceled', 'beta')
  ),
  constraint user_entitlements_account_limit_check check (
    account_limit is null or account_limit > 0
  ),
  constraint user_entitlements_scan_limit_check check (
    screenshot_monthly_limit >= 0
  )
);

alter table public.user_entitlements enable row level security;
revoke all on table public.user_entitlements from anon, authenticated;
grant select on table public.user_entitlements to authenticated;

drop policy if exists "Users can view their own entitlement" on public.user_entitlements;
create policy "Users can view their own entitlement" on public.user_entitlements
  for select using (auth.uid() = user_id);

drop trigger if exists update_user_entitlements_updated_at on public.user_entitlements;
create trigger update_user_entitlements_updated_at
  before update on public.user_entitlements
  for each row execute function public.update_updated_at_column();

-- Existing beta users retain unrestricted account access. Billing/webhooks
-- can later replace these rows without changing product code.
insert into public.user_entitlements (
  user_id, tier, status, account_limit, screenshot_monthly_limit
)
select id, 'founding', 'beta', null, 250
from auth.users
on conflict (user_id) do nothing;

create or replace function public.provision_starter_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.user_entitlements (
    user_id, tier, status, account_limit, screenshot_monthly_limit
  ) values (new.id, 'starter', 'active', 2, 3)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists provision_starter_entitlement_on_signup on auth.users;
create trigger provision_starter_entitlement_on_signup
  after insert on auth.users
  for each row execute function public.provision_starter_entitlement();

-- Enforce tracked-account limits in the database so a modified client cannot
-- bypass them. The account quantity bundle is included in the count.
create or replace function public.enforce_account_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit integer;
  v_existing integer;
begin
  select account_limit into v_limit
  from public.user_entitlements
  where user_id = new.user_id
    and status in ('active', 'trialing', 'beta');

  if not found then
    v_limit := 2;
  end if;
  if v_limit is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 1));

  if tg_op = 'UPDATE' then
    select coalesce(sum(coalesce(quantity, 1)), 0)::integer into v_existing
    from public.accounts
    where user_id = new.user_id and id <> old.id;
  else
    select coalesce(sum(coalesce(quantity, 1)), 0)::integer into v_existing
    from public.accounts
    where user_id = new.user_id;
  end if;

  if v_existing + coalesce(new.quantity, 1) > v_limit then
    raise exception 'Tracked account limit reached for the current plan';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_account_entitlement_on_accounts on public.accounts;
create trigger enforce_account_entitlement_on_accounts
  before insert or update of user_id, quantity on public.accounts
  for each row execute function public.enforce_account_entitlement();

-- Replace the operational-only reservation with plan-aware monthly metering.
drop function if exists public.reserve_screenshot_scan(integer);
create function public.reserve_screenshot_scan(p_image_count integer)
returns table (
  request_id uuid,
  used_last_hour integer,
  used_today integer,
  used_this_month integer,
  monthly_limit integer,
  subscription_tier text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_id uuid;
  v_hour integer;
  v_day integer;
  v_month integer;
  v_limit integer;
  v_tier text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_image_count is null or p_image_count < 1 or p_image_count > 8 then
    raise exception 'Screenshot count must be between 1 and 8';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select tier, screenshot_monthly_limit into v_tier, v_limit
  from public.user_entitlements
  where user_id = v_user_id
    and status in ('active', 'trialing', 'beta');

  if not found then
    v_tier := 'starter';
    v_limit := 3;
  end if;

  select count(*)::integer into v_hour
  from public.screenshot_scan_requests
  where user_id = v_user_id and requested_at >= now() - interval '1 hour';

  select count(*)::integer into v_day
  from public.screenshot_scan_requests
  where user_id = v_user_id and requested_at >= date_trunc('day', now());

  select coalesce(sum(image_count), 0)::integer into v_month
  from public.screenshot_scan_requests
  where user_id = v_user_id and requested_at >= date_trunc('month', now());

  if v_hour >= 6 then
    raise exception 'Screenshot scan hourly safety limit reached';
  end if;
  if v_day >= 20 then
    raise exception 'Screenshot scan daily safety limit reached';
  end if;
  if v_month + p_image_count > v_limit then
    raise exception 'Screenshot scan plan quota reached';
  end if;

  insert into public.screenshot_scan_requests (user_id, image_count)
  values (v_user_id, p_image_count)
  returning id into v_request_id;

  return query select
    v_request_id,
    v_hour + 1,
    v_day + 1,
    v_month + p_image_count,
    v_limit,
    v_tier;
end;
$$;

revoke all on function public.reserve_screenshot_scan(integer) from public;
revoke execute on function public.reserve_screenshot_scan(integer) from anon;
grant execute on function public.reserve_screenshot_scan(integer) to authenticated;

comment on table public.user_entitlements is
  'Server-owned subscription tier, status, account cap, and screenshot quota for each user.';
