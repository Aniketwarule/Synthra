create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null unique,
  name text not null,
  description text not null,
  price_algo numeric(18, 6) not null check (price_algo > 0),
  creator_wallet text not null,
  hosting_type text not null check (hosting_type in ('internal', 'external')),
  base_model text,
  system_prompt text,
  endpoint_url text,
  api_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agents_internal_requires_fields check (
    hosting_type <> 'internal' or (base_model is not null and system_prompt is not null and api_key is not null)
  ),
  constraint agents_external_requires_endpoint check (
    hosting_type <> 'external' or endpoint_url is not null
  )
);

create index if not exists idx_agents_name on agents(name);
create index if not exists idx_agents_creator_wallet on agents(creator_wallet);
create index if not exists idx_agents_created_at on agents(created_at desc);

drop trigger if exists trg_agents_set_updated_at on agents;
create trigger trg_agents_set_updated_at
before update on agents
for each row
execute function set_updated_at();

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  model_id text not null,
  upstream_model text not null,
  wallet_address text not null,
  hits bigint not null default 0,
  total_tokens bigint not null default 0,
  accrued_algo numeric(18, 6) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_api_keys_key on api_keys(key);
create index if not exists idx_api_keys_wallet_address on api_keys(wallet_address);
create index if not exists idx_api_keys_created_at on api_keys(created_at desc);

drop trigger if exists trg_api_keys_set_updated_at on api_keys;
create trigger trg_api_keys_set_updated_at
before update on api_keys
for each row
execute function set_updated_at();

create table if not exists usage_logs (
  id uuid primary key default gen_random_uuid(),
  api_key_masked text not null,
  model_id text not null,
  upstream_model text not null,
  wallet_address text not null,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  prompt_snippet text not null default '',
  response_snippet text not null default '',
  latency_ms integer not null default 0,
  status text not null check (status in ('success', 'error')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_usage_logs_api_key_masked on usage_logs(api_key_masked);
create index if not exists idx_usage_logs_wallet_address on usage_logs(wallet_address);
create index if not exists idx_usage_logs_created_at on usage_logs(created_at desc);

create table if not exists payment_tx_proofs (
  tx_id text not null,
  scope text not null,
  status text not null check (status in ('in_flight', 'consumed')),
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (tx_id, scope)
);

create index if not exists idx_payment_tx_proofs_status on payment_tx_proofs(status);
create index if not exists idx_payment_tx_proofs_created_at on payment_tx_proofs(created_at);

drop trigger if exists trg_payment_tx_proofs_set_updated_at on payment_tx_proofs;
create trigger trg_payment_tx_proofs_set_updated_at
before update on payment_tx_proofs
for each row
execute function set_updated_at();

create or replace function increment_api_key_usage(
  p_key text,
  p_total_tokens bigint,
  p_accrued_algo numeric
)
returns table (
  id uuid,
  key text,
  model_id text,
  upstream_model text,
  wallet_address text,
  hits bigint,
  total_tokens bigint,
  accrued_algo numeric,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
as $$
begin
  return query
  update api_keys
  set
    hits = api_keys.hits + 1,
    total_tokens = api_keys.total_tokens + p_total_tokens,
    accrued_algo = api_keys.accrued_algo + p_accrued_algo,
    updated_at = now()
  where api_keys.key = p_key
    and api_keys.is_active = true
  returning
    api_keys.id,
    api_keys.key,
    api_keys.model_id,
    api_keys.upstream_model,
    api_keys.wallet_address,
    api_keys.hits,
    api_keys.total_tokens,
    api_keys.accrued_algo,
    api_keys.is_active,
    api_keys.created_at,
    api_keys.updated_at;
end;
$$;
