alter table public.import_accounts
  add column if not exists balance_minor bigint,
  add column if not exists balance_currency text not null default 'DKK',
  add column if not exists balance_updated_at timestamptz,
  add column if not exists last_imported_at timestamptz,
  add column if not exists last_posting_date date;

alter table public.imported_transactions
  add column if not exists import_account_id uuid references public.import_accounts(id) on delete set null;

create index if not exists imported_transactions_user_import_account_idx
  on public.imported_transactions (user_id, import_account_id);

create index if not exists imported_transactions_user_category_idx
  on public.imported_transactions (user_id, category);
