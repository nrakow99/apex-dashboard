-- Persist trade journal metadata on trades (syncs across devices).
alter table public.trades
  add column if not exists session text,
  add column if not exists direction text,
  add column if not exists grade text,
  add column if not exists setup_tags jsonb not null default '[]'::jsonb,
  add column if not exists discipline_tags jsonb not null default '[]'::jsonb,
  add column if not exists entry_price numeric,
  add column if not exists exit_price numeric,
  add column if not exists contracts integer;

comment on column public.trades.session is 'Session id: ny_am | ny_pm | london';
comment on column public.trades.direction is 'Trade direction: long | short';
comment on column public.trades.setup_tags is 'Setup tag labels (json array)';
comment on column public.trades.discipline_tags is 'Discipline tag labels (json array)';
