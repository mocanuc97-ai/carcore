-- Add support for per-tenant ANAF e-Factura connection

create table if not exists public.tenant_anaf_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade unique,
  
  -- Connection details (OAuth or certificate based)
  connection_type text not null default 'oauth' check (connection_type in ('oauth', 'certificate')),
  
  -- For OAuth flow with ANAF SPV
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  
  -- Company identifiers needed for e-Factura
  cui text,                    -- Fiscal code of the service (required)
  company_name text,
  
  -- Status
  status text not null default 'disconnected' check (status in ('disconnected', 'connected', 'expired', 'error')),
  last_sync_at timestamptz,
  last_error text,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists tenant_anaf_connections_tenant_id_idx on public.tenant_anaf_connections(tenant_id);

alter table public.tenant_anaf_connections enable row level security;

create policy "tenant_anaf_isolation" on public.tenant_anaf_connections
  for all using (
    tenant_id = (select tenant_id from public.profiles where id = auth.uid())
  );

-- Add CUI to tenants for convenience (if not present)
alter table public.tenants 
  add column if not exists cui text;

comment on table public.tenant_anaf_connections is 'Stores ANAF SPV connection per service for e-Factura';
comment on column public.tenant_anaf_connections.cui is 'Fiscal code (CUI) of the company - required for e-Factura';