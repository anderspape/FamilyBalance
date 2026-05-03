alter table public.imported_transactions
  add column if not exists kind text not null default 'expense';

alter table public.imported_transactions
  add column if not exists raw jsonb not null default '{}'::jsonb;

alter table public.imported_transactions
  alter column currency set default 'DKK';

create table if not exists public.import_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  account_number text,
  description text,
  created_at timestamptz not null default now()
);

create unique index if not exists import_accounts_user_name_idx
  on public.import_accounts (user_id, (lower(name)));

alter table public.import_accounts enable row level security;

drop policy if exists "Users can read their own import accounts"
  on public.import_accounts;
create policy "Users can read their own import accounts"
  on public.import_accounts for select
  using (user_id = auth.uid());

drop policy if exists "Users can insert their own import accounts"
  on public.import_accounts;
create policy "Users can insert their own import accounts"
  on public.import_accounts for insert
  with check (user_id = auth.uid());

drop policy if exists "Users can update their own import accounts"
  on public.import_accounts;
create policy "Users can update their own import accounts"
  on public.import_accounts for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their own import accounts"
  on public.import_accounts;
create policy "Users can delete their own import accounts"
  on public.import_accounts for delete
  using (user_id = auth.uid());
