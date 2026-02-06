-- Fraud Prevention Tables
create table if not exists public.fraud_rules (
  id text primary key,
  name text not null,
  type text not null,
  enabled boolean default true,
  severity text not null,
  threshold integer not null,
  time_window integer not null,
  action text not null,
  description text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.fraud_alerts (
  id text primary key,
  rule_id text references public.fraud_rules(id),
  severity text not null,
  user_did text,
  publisher_did text,
  campaign_id text,
  ip_address inet,
  user_agent text,
  details jsonb,
  status text default 'active',
  created_at timestamp with time zone default now(),
  resolved_at timestamp with time zone
);

create table if not exists public.session_analytics (
  session_id text primary key,
  user_did text,
  ip_address inet,
  user_agent text,
  device_fingerprint text,
  events jsonb default '[]',
  risk_score integer default 0,
  flags text[],
  created_at timestamp with time zone default now(),
  last_activity timestamp with time zone default now()
);

-- Indexes
create index if not exists idx_fraud_alerts_status on public.fraud_alerts(status);
create index if not exists idx_fraud_alerts_severity on public.fraud_alerts(severity);
create index if not exists idx_session_analytics_ip on public.session_analytics(ip_address);

-- RLS
alter table public.fraud_rules enable row level security;
alter table public.fraud_alerts enable row level security;
alter table public.session_analytics enable row level security;

-- Policies
create policy "Admin can do everything on fraud_rules"
  on public.fraud_rules
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admin can do everything on fraud_alerts"
  on public.fraud_alerts
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admin can do everything on session_analytics"
  on public.session_analytics
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
