-- Review-first screenshot trade imports.
--
-- Imported rows are daily-symbol aggregates when that is what the source
-- shows. They contribute their confirmed Net P&L to existing rule math but
-- are never represented as invented individual fills.

create table if not exists public.trade_import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  source text not null check (source in ('lucid_trading_history', 'generic_trading_history', 'unknown')),
  filenames text[] not null default '{}',
  row_count integer not null check (row_count > 0),
  coverage_start date,
  coverage_end date,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.trade_import_batches enable row level security;

drop policy if exists "Users can view their own trade import batches" on public.trade_import_batches;
create policy "Users can view their own trade import batches" on public.trade_import_batches
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own trade import batches" on public.trade_import_batches;
create policy "Users can insert their own trade import batches" on public.trade_import_batches
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.accounts
      where accounts.id = account_id and accounts.user_id = auth.uid()
    )
  );

alter table public.trades
  add column if not exists import_source text,
  add column if not exists raw_symbol text,
  add column if not exists is_aggregate boolean not null default false,
  add column if not exists pnl_high numeric,
  add column if not exists pnl_low numeric,
  add column if not exists commission numeric,
  add column if not exists avg_win numeric,
  add column if not exists avg_loss numeric,
  add column if not exists win_duration_seconds integer,
  add column if not exists loss_duration_seconds integer,
  add column if not exists win_rate_percent numeric,
  add column if not exists extraction_confidence text,
  add column if not exists import_batch_id uuid references public.trade_import_batches(id) on delete set null,
  add column if not exists import_key text;

alter table public.trades drop constraint if exists trades_import_source_check;
alter table public.trades add constraint trades_import_source_check
  check (import_source is null or import_source in ('screenshot'));

alter table public.trades drop constraint if exists trades_extraction_confidence_check;
alter table public.trades add constraint trades_extraction_confidence_check
  check (extraction_confidence is null or extraction_confidence in ('high', 'medium', 'low'));

alter table public.trades drop constraint if exists trades_commission_check;
alter table public.trades add constraint trades_commission_check
  check (commission is null or commission >= 0);

alter table public.trades drop constraint if exists trades_import_durations_check;
alter table public.trades add constraint trades_import_durations_check
  check (
    (win_duration_seconds is null or win_duration_seconds >= 0)
    and (loss_duration_seconds is null or loss_duration_seconds >= 0)
  );

alter table public.trades drop constraint if exists trades_win_rate_percent_check;
alter table public.trades add constraint trades_win_rate_percent_check
  check (win_rate_percent is null or (win_rate_percent >= 0 and win_rate_percent <= 100));

-- PostgreSQL unique indexes allow multiple null values, so manual trades with
-- no import key remain unrestricted while confirmed imports are idempotent.
create unique index if not exists trades_account_import_key_key
  on public.trades (account_id, import_key);

create index if not exists trade_import_batches_account_id_idx
  on public.trade_import_batches (account_id, created_at desc);

create or replace function public.import_screenshot_trade_rows(
  p_account_id uuid,
  p_source text,
  p_filenames text[],
  p_coverage_start date,
  p_coverage_end date,
  p_warnings jsonb,
  p_rows jsonb
)
returns table (batch_id uuid, inserted_count integer, duplicate_count integer)
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_batch_id uuid;
  v_total integer;
  v_inserted integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.accounts
    where id = p_account_id and user_id = v_user_id
  ) then
    raise exception 'Account not found';
  end if;

  if p_source not in ('lucid_trading_history', 'generic_trading_history', 'unknown') then
    raise exception 'Unsupported import source';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Import rows must be an array';
  end if;

  v_total := jsonb_array_length(p_rows);
  if v_total < 1 or v_total > 500 then
    raise exception 'Import must contain between 1 and 500 rows';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as row_data(
      trade_date date,
      symbol text,
      raw_symbol text,
      pnl numeric,
      contracts integer,
      notes text,
      pnl_high numeric,
      pnl_low numeric,
      commission numeric,
      avg_win numeric,
      avg_loss numeric,
      win_duration_seconds integer,
      loss_duration_seconds integer,
      win_rate_percent numeric,
      extraction_confidence text,
      import_key text
    )
    where row_data.trade_date is null
      or nullif(trim(row_data.symbol), '') is null
      or nullif(trim(row_data.raw_symbol), '') is null
      or row_data.pnl is null
      or nullif(trim(row_data.import_key), '') is null
      or (row_data.contracts is not null and row_data.contracts < 0)
      or (row_data.commission is not null and row_data.commission < 0)
      or (row_data.win_duration_seconds is not null and row_data.win_duration_seconds < 0)
      or (row_data.loss_duration_seconds is not null and row_data.loss_duration_seconds < 0)
      or (row_data.win_rate_percent is not null and (row_data.win_rate_percent < 0 or row_data.win_rate_percent > 100))
      or row_data.extraction_confidence not in ('high', 'medium', 'low')
  ) then
    raise exception 'One or more import rows failed validation';
  end if;

  insert into public.trade_import_batches (
    user_id,
    account_id,
    source,
    filenames,
    row_count,
    coverage_start,
    coverage_end,
    warnings
  ) values (
    v_user_id,
    p_account_id,
    p_source,
    coalesce(p_filenames, '{}'),
    v_total,
    p_coverage_start,
    p_coverage_end,
    coalesce(p_warnings, '[]'::jsonb)
  ) returning id into v_batch_id;

  with parsed as (
    select *
    from jsonb_to_recordset(p_rows) as row_data(
      trade_date date,
      symbol text,
      raw_symbol text,
      pnl numeric,
      contracts integer,
      notes text,
      pnl_high numeric,
      pnl_low numeric,
      commission numeric,
      avg_win numeric,
      avg_loss numeric,
      win_duration_seconds integer,
      loss_duration_seconds integer,
      win_rate_percent numeric,
      extraction_confidence text,
      import_key text
    )
  ), inserted as (
    insert into public.trades (
      user_id,
      account_id,
      date,
      symbol,
      pnl,
      notes,
      contracts,
      import_source,
      raw_symbol,
      is_aggregate,
      pnl_high,
      pnl_low,
      commission,
      avg_win,
      avg_loss,
      win_duration_seconds,
      loss_duration_seconds,
      win_rate_percent,
      extraction_confidence,
      import_batch_id,
      import_key
    )
    select
      v_user_id,
      p_account_id,
      parsed.trade_date,
      upper(parsed.symbol),
      parsed.pnl,
      parsed.notes,
      parsed.contracts,
      'screenshot',
      upper(parsed.raw_symbol),
      true,
      parsed.pnl_high,
      parsed.pnl_low,
      parsed.commission,
      parsed.avg_win,
      parsed.avg_loss,
      parsed.win_duration_seconds,
      parsed.loss_duration_seconds,
      parsed.win_rate_percent,
      parsed.extraction_confidence,
      v_batch_id,
      parsed.import_key
    from parsed
    on conflict (account_id, import_key) do nothing
    returning 1
  )
  select count(*)::integer into v_inserted from inserted;

  if v_inserted = 0 then
    delete from public.trade_import_batches where id = v_batch_id;
    v_batch_id := null;
  else
    update public.trade_import_batches
    set row_count = v_inserted
    where id = v_batch_id;
  end if;

  return query select v_batch_id, v_inserted, v_total - v_inserted;
end;
$$;

revoke all on function public.import_screenshot_trade_rows(uuid, text, text[], date, date, jsonb, jsonb) from public;
grant execute on function public.import_screenshot_trade_rows(uuid, text, text[], date, date, jsonb, jsonb) to authenticated;
