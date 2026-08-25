-- Durable product state that must follow a trader across devices.
--
-- This migration intentionally does not contain prop-firm rule values. Firm
-- rules remain application-owned and are resolved only through
-- getAccountRules(). The numeric limits below are operational abuse limits
-- for the paid screenshot-processing endpoint, not subscription entitlements.

create table if not exists public.account_costs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  cost_date date not null,
  category text not null,
  amount numeric(12, 2) not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_costs_category_check check (
    category in ('evaluation', 'activation', 'reset', 'platform', 'data', 'other')
  ),
  constraint account_costs_amount_check check (amount > 0)
);

create index if not exists account_costs_user_date_idx
  on public.account_costs (user_id, cost_date desc);
create index if not exists account_costs_account_date_idx
  on public.account_costs (account_id, cost_date desc);

alter table public.account_costs enable row level security;

revoke all on table public.account_costs from anon;
grant select, insert, update, delete on table public.account_costs to authenticated;

drop policy if exists "Users can view their own account costs" on public.account_costs;
create policy "Users can view their own account costs" on public.account_costs
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own account costs" on public.account_costs;
create policy "Users can insert their own account costs" on public.account_costs
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.accounts
      where accounts.id = account_id and accounts.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update their own account costs" on public.account_costs;
create policy "Users can update their own account costs" on public.account_costs
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.accounts
      where accounts.id = account_id and accounts.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete their own account costs" on public.account_costs;
create policy "Users can delete their own account costs" on public.account_costs
  for delete using (auth.uid() = user_id);

drop trigger if exists update_account_costs_updated_at on public.account_costs;
create trigger update_account_costs_updated_at
  before update on public.account_costs
  for each row execute function public.update_updated_at_column();

-- One user-authored pre-trade plan per calendar day. These are personal risk
-- controls, never firm-rule values, and the UI must label them that way.
create table if not exists public.daily_session_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_date date not null,
  reviewed_risk_queue boolean not null default false,
  confirmed_firm_portal boolean not null default false,
  checked_news_events boolean not null default false,
  personal_loss_limit numeric(12, 2),
  max_trades integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_session_plans_user_date_key unique (user_id, plan_date),
  constraint daily_session_plans_loss_limit_check check (
    personal_loss_limit is null or personal_loss_limit > 0
  ),
  constraint daily_session_plans_max_trades_check check (
    max_trades is null or (max_trades > 0 and max_trades <= 100)
  )
);

create index if not exists daily_session_plans_user_date_idx
  on public.daily_session_plans (user_id, plan_date desc);

alter table public.daily_session_plans enable row level security;

revoke all on table public.daily_session_plans from anon;
grant select, insert, update, delete on table public.daily_session_plans to authenticated;

drop policy if exists "Users can view their own session plans" on public.daily_session_plans;
create policy "Users can view their own session plans" on public.daily_session_plans
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own session plans" on public.daily_session_plans;
create policy "Users can insert their own session plans" on public.daily_session_plans
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own session plans" on public.daily_session_plans;
create policy "Users can update their own session plans" on public.daily_session_plans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own session plans" on public.daily_session_plans;
create policy "Users can delete their own session plans" on public.daily_session_plans
  for delete using (auth.uid() = user_id);

drop trigger if exists update_daily_session_plans_updated_at on public.daily_session_plans;
create trigger update_daily_session_plans_updated_at
  before update on public.daily_session_plans
  for each row execute function public.update_updated_at_column();

-- The product guide currently starts in local storage. Persisting the same
-- small state on user_settings lets it resume on another device.
alter table public.user_settings
  add column if not exists onboarding_started boolean not null default false,
  add column if not exists onboarding_dismissed boolean not null default false,
  add column if not exists onboarding_visited_paths text[] not null default '{}';

-- Durable metering for the external screenshot-processing endpoint. Images
-- are deliberately not stored. Rows record request volume and outcome only.
create table if not exists public.screenshot_scan_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  image_count integer not null,
  status text not null default 'reserved',
  extracted_row_count integer,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint screenshot_scan_requests_image_count_check check (
    image_count > 0 and image_count <= 8
  ),
  constraint screenshot_scan_requests_status_check check (
    status in ('reserved', 'succeeded', 'failed')
  ),
  constraint screenshot_scan_requests_row_count_check check (
    extracted_row_count is null or (extracted_row_count >= 0 and extracted_row_count <= 500)
  )
);

create index if not exists screenshot_scan_requests_user_time_idx
  on public.screenshot_scan_requests (user_id, requested_at desc);

alter table public.screenshot_scan_requests enable row level security;

revoke all on table public.screenshot_scan_requests from anon;
grant select on table public.screenshot_scan_requests to authenticated;

drop policy if exists "Users can view their own screenshot usage" on public.screenshot_scan_requests;
create policy "Users can view their own screenshot usage" on public.screenshot_scan_requests
  for select using (auth.uid() = user_id);

-- No direct INSERT/UPDATE policy is intentional. Requests must go through
-- these functions so a client cannot bypass metering or rewrite usage.
create or replace function public.reserve_screenshot_scan(p_image_count integer)
returns table (
  request_id uuid,
  used_last_hour integer,
  used_today integer,
  used_this_month integer
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
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_image_count is null or p_image_count < 1 or p_image_count > 8 then
    raise exception 'Screenshot count must be between 1 and 8';
  end if;

  -- Serialize reservations per user so concurrent tabs cannot race the count.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select count(*)::integer into v_hour
  from public.screenshot_scan_requests
  where user_id = v_user_id and requested_at >= now() - interval '1 hour';

  select count(*)::integer into v_day
  from public.screenshot_scan_requests
  where user_id = v_user_id and requested_at >= date_trunc('day', now());

  select count(*)::integer into v_month
  from public.screenshot_scan_requests
  where user_id = v_user_id and requested_at >= date_trunc('month', now());

  if v_hour >= 6 then
    raise exception 'Screenshot scan hourly safety limit reached';
  end if;
  if v_day >= 20 then
    raise exception 'Screenshot scan daily safety limit reached';
  end if;
  if v_month >= 100 then
    raise exception 'Screenshot scan monthly safety limit reached';
  end if;

  insert into public.screenshot_scan_requests (user_id, image_count)
  values (v_user_id, p_image_count)
  returning id into v_request_id;

  return query select v_request_id, v_hour + 1, v_day + 1, v_month + 1;
end;
$$;

create or replace function public.finish_screenshot_scan(
  p_request_id uuid,
  p_status text,
  p_extracted_row_count integer default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_status not in ('succeeded', 'failed') then
    raise exception 'Unsupported screenshot scan status';
  end if;
  if p_extracted_row_count is not null and (p_extracted_row_count < 0 or p_extracted_row_count > 500) then
    raise exception 'Extracted row count must be between 0 and 500';
  end if;

  update public.screenshot_scan_requests
  set status = p_status,
      extracted_row_count = p_extracted_row_count,
      completed_at = now()
  where id = p_request_id
    and user_id = v_user_id
    and status = 'reserved';

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.reserve_screenshot_scan(integer) from public;
revoke all on function public.finish_screenshot_scan(uuid, text, integer) from public;
grant execute on function public.reserve_screenshot_scan(integer) to authenticated;
grant execute on function public.finish_screenshot_scan(uuid, text, integer) to authenticated;

comment on table public.account_costs is
  'User-entered evaluation, activation, reset, platform, data, and other account costs.';
comment on table public.daily_session_plans is
  'User-authored daily controls; values are personal limits and never prop-firm rules.';
comment on table public.screenshot_scan_requests is
  'Durable metadata and abuse-control counters for screenshot extraction; uploaded images are not stored.';
