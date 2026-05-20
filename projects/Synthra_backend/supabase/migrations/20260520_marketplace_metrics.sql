-- Marketplace Endpoints
create table if not exists marketplace_endpoints (
  id uuid primary key default gen_random_uuid(),
  creator_wallet text not null,
  name text not null,
  description text,
  target_url text not null,
  price_usdc numeric(18, 6) not null default 0,
  tags text[] default array[]::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_marketplace_endpoints_creator on marketplace_endpoints(creator_wallet);

drop trigger if exists trg_marketplace_endpoints_set_updated_at on marketplace_endpoints;
create trigger trg_marketplace_endpoints_set_updated_at
before update on marketplace_endpoints
for each row
execute function set_updated_at();

-- Endpoint Usage Logs
create table if not exists endpoint_usage_logs (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid references marketplace_endpoints(id) on delete cascade,
  consumer_wallet text not null,
  latency_ms integer not null default 0,
  revenue_usdc numeric(18, 6) not null default 0,
  status text not null check (status in ('success', 'error')),
  created_at timestamptz not null default now()
);

create index if not exists idx_endpoint_usage_logs_endpoint on endpoint_usage_logs(endpoint_id);
create index if not exists idx_endpoint_usage_logs_consumer on endpoint_usage_logs(consumer_wallet);
create index if not exists idx_endpoint_usage_logs_created on endpoint_usage_logs(created_at desc);
