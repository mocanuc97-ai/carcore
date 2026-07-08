-- Parts purchased from distributors, used in interventions and invoiced to clients

create table if not exists public.parts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  intervention_id uuid references public.interventions(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete cascade,
  name text not null,
  distributor text,                    -- e.g. "Autovit", "Bucuresti Parts", etc.
  quantity numeric(10,2) not null default 1,
  purchase_price numeric(10,2) not null,   -- cost from distributor
  selling_price numeric(10,2) not null,    -- price charged to client
  notes text,
  created_at timestamptz default now()
);

create index if not exists parts_tenant_id_idx on public.parts(tenant_id);
create index if not exists parts_intervention_id_idx on public.parts(intervention_id);
create index if not exists parts_vehicle_id_idx on public.parts(vehicle_id);

alter table public.parts enable row level security;

create policy "parts_tenant_isolation" on public.parts
  for all using (
    tenant_id = (select tenant_id from public.profiles where id = auth.uid())
  );

-- Allow adding parts directly to invoices as well (for flexibility)
-- We will use invoice_items for both services and parts, or extend.
-- For now, we'll treat parts as separate lines when creating invoices.

comment on table public.parts is 'Spare parts purchased from distributors for specific jobs/vehicles';
comment on column public.parts.distributor is 'Name of the supplier/distributor the part was bought from';