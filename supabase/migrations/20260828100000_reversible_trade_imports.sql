-- Make every supported import reversible as one audited batch.
alter table public.trade_import_batches drop constraint if exists trade_import_batches_source_check;
alter table public.trade_import_batches add constraint trade_import_batches_source_check
  check (source in ('csv', 'lucid_trading_history', 'generic_trading_history', 'unknown'));

alter table public.trades drop constraint if exists trades_import_source_check;
alter table public.trades add constraint trades_import_source_check
  check (import_source is null or import_source in ('screenshot', 'csv'));

create or replace function public.import_csv_trade_rows(
  p_account_id uuid,
  p_filename text,
  p_rows jsonb
)
returns table (batch_id uuid, inserted_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_batch_id uuid;
  v_total integer;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.accounts where id = p_account_id and user_id = v_user_id) then
    raise exception 'Account not found';
  end if;
  if nullif(trim(p_filename), '') is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'CSV import is incomplete';
  end if;
  v_total := jsonb_array_length(p_rows);
  if v_total < 1 or v_total > 2000 then raise exception 'CSV import must contain between 1 and 2000 rows'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_rows) as row_data(
      trade_date date, symbol text, pnl numeric, contracts integer, notes text
    ) where row_data.trade_date is null
      or nullif(trim(row_data.symbol), '') is null
      or row_data.pnl is null
      or (row_data.contracts is not null and row_data.contracts < 0)
  ) then raise exception 'One or more CSV rows failed validation'; end if;

  insert into public.trade_import_batches (
    user_id, account_id, source, filenames, row_count, coverage_start, coverage_end
  )
  select v_user_id, p_account_id, 'csv', array[p_filename], v_total,
    min(row_data.trade_date), max(row_data.trade_date)
  from jsonb_to_recordset(p_rows) as row_data(
    trade_date date, symbol text, pnl numeric, contracts integer, notes text
  ) returning id into v_batch_id;

  insert into public.trades (
    user_id, account_id, date, symbol, pnl, notes, contracts, import_source, import_batch_id
  )
  select v_user_id, p_account_id, row_data.trade_date, upper(trim(row_data.symbol)),
    row_data.pnl, row_data.notes, row_data.contracts, 'csv', v_batch_id
  from jsonb_to_recordset(p_rows) as row_data(
    trade_date date, symbol text, pnl numeric, contracts integer, notes text
  );

  return query select v_batch_id, v_total;
end;
$$;

create or replace function public.delete_trade_import_batch(p_batch_id uuid)
returns table (deleted_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_deleted integer;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from public.trade_import_batches where id = p_batch_id and user_id = v_user_id
  ) then raise exception 'Import batch not found'; end if;

  delete from public.trades
  where import_batch_id = p_batch_id and user_id = v_user_id;
  get diagnostics v_deleted = row_count;

  delete from public.trade_import_batches
  where id = p_batch_id and user_id = v_user_id;

  return query select v_deleted;
end;
$$;

revoke all on function public.import_csv_trade_rows(uuid, text, jsonb) from public, anon;
grant execute on function public.import_csv_trade_rows(uuid, text, jsonb) to authenticated;
revoke all on function public.delete_trade_import_batch(uuid) from public, anon;
grant execute on function public.delete_trade_import_batch(uuid) to authenticated;
