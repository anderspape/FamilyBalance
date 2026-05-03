create table if not exists public.imported_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  source_hash text not null,
  account_name text not null,
  account_number text not null,
  booking_date date not null,
  description text not null,
  amount_minor bigint not null,
  currency text not null default 'DKK',
  category text,
  kind text not null,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists imported_transactions_user_source_hash_idx
  on public.imported_transactions (user_id, source_hash);

create index if not exists imported_transactions_user_booking_date_idx
  on public.imported_transactions (user_id, booking_date desc);

alter table public.imported_transactions enable row level security;

create policy "Users can read their own imported transactions"
  on public.imported_transactions for select
  using (user_id = auth.uid());

create policy "Users can insert their own imported transactions"
  on public.imported_transactions for insert
  with check (user_id = auth.uid());

create policy "Users can update their own imported transactions"
  on public.imported_transactions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own imported transactions"
  on public.imported_transactions for delete
  using (user_id = auth.uid());
