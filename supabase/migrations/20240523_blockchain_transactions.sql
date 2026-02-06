-- Blockchain Transactions Table for TransactionManager
create table if not exists public.blockchain_transactions (
  id uuid default uuid_generate_v4() primary key,
  type text not null,
  status text default 'pending',
  tx_hash text,
  block_number bigint,
  gas_used text,
  gas_price text,
  error_message text,
  retry_count integer default 0,
  max_retries integer default 3,
  payload jsonb not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  confirmed_at timestamp with time zone
);

-- Payouts Table
create table if not exists public.payouts (
  id uuid default uuid_generate_v4() primary key,
  campaign_id uuid references public.campaigns(id),
  transaction_id uuid references public.blockchain_transactions(id),
  recipient_address text not null,
  recipient_did text,
  amount decimal(18,6) not null,
  role text not null,
  status text default 'pending',
  event_ids text[],
  created_at timestamp with time zone default now(),
  processed_at timestamp with time zone
);

-- Indexes
create index if not exists idx_blockchain_transactions_status on public.blockchain_transactions(status);
create index if not exists idx_blockchain_transactions_type on public.blockchain_transactions(type);
create index if not exists idx_payouts_campaign_id on public.payouts(campaign_id);

-- RLS
alter table public.blockchain_transactions enable row level security;
alter table public.payouts enable row level security;

-- Policies (Admin only for now as this is a backend system table)
create policy "Admin can do everything on blockchain_transactions"
  on public.blockchain_transactions
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admin can do everything on payouts"
  on public.payouts
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
