alter table public.import_accounts
  add column if not exists closed_at timestamptz;

create index if not exists import_accounts_user_closed_at_idx
  on public.import_accounts (user_id, closed_at);
