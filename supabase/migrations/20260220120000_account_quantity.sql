-- Grouped identical accounts (e.g. 2x Lucid 50K Eval on one card)
alter table accounts
  add column if not exists quantity integer not null default 1;

alter table accounts
  add constraint accounts_quantity_range check (quantity >= 1 and quantity <= 20);
