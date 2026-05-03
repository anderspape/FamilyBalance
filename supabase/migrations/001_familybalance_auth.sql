create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  status text not null,
  external_connection_id text,
  connected_at timestamptz,
  synced_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.bank_connections(id) on delete cascade,
  provider_account_id text not null,
  name text not null,
  currency text not null default 'DKK',
  balance_minor bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.bank_accounts(id) on delete cascade,
  provider_transaction_id text,
  booking_date date,
  description text not null,
  category text,
  amount_minor bigint not null,
  currency text not null default 'DKK',
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists bank_connections_provider_external_idx
  on public.bank_connections (user_id, provider, external_connection_id)
  where external_connection_id is not null;

create unique index if not exists bank_accounts_provider_account_idx
  on public.bank_accounts (user_id, connection_id, provider_account_id);

create unique index if not exists bank_transactions_provider_transaction_idx
  on public.bank_transactions (user_id, provider_transaction_id)
  where provider_transaction_id is not null;

alter table public.profiles enable row level security;
alter table public.bank_connections enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.bank_transactions enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Users can update their own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Users can read their own bank connections"
  on public.bank_connections for select
  using (user_id = auth.uid());

create policy "Users can insert their own bank connections"
  on public.bank_connections for insert
  with check (user_id = auth.uid());

create policy "Users can update their own bank connections"
  on public.bank_connections for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own bank connections"
  on public.bank_connections for delete
  using (user_id = auth.uid());

create policy "Users can read their own bank accounts"
  on public.bank_accounts for select
  using (user_id = auth.uid());

create policy "Users can insert their own bank accounts"
  on public.bank_accounts for insert
  with check (user_id = auth.uid());

create policy "Users can update their own bank accounts"
  on public.bank_accounts for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own bank accounts"
  on public.bank_accounts for delete
  using (user_id = auth.uid());

create policy "Users can read their own bank transactions"
  on public.bank_transactions for select
  using (user_id = auth.uid());

create policy "Users can insert their own bank transactions"
  on public.bank_transactions for insert
  with check (user_id = auth.uid());

create policy "Users can update their own bank transactions"
  on public.bank_transactions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own bank transactions"
  on public.bank_transactions for delete
  using (user_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
    set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
