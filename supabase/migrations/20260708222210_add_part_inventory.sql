-- Simple inventory for parts purchased from distributors

create table if not exists public.part_inventory (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  distributor text,
  current_stock numeric(10,2) not null default 0,
  last_purchase_price numeric(10,2),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(tenant_id, name, distributor)
);

create index if not exists part_inventory_tenant_idx on public.part_inventory(tenant_id);

alter table public.part_inventory enable row level security;

create policy "part_inventory_tenant_isolation" on public.part_inventory
  for all using (tenant_id = (select tenant_id from public.profiles where id = auth.uid()));

comment on table public.part_inventory is 'Current stock of parts purchased from distributors';

-- When a part is purchased (added as "purchase"), we can upsert to inventory
-- When used in intervention or invoiced, deduct.

-- For simplicity in MVP, we'll calculate stock on the fly from parts table or add logic in code.
-- Add trigger or just handle in app for now.