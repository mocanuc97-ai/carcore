-- Client type (persoana fizica / persoana juridica) + CUI for companies
alter table public.clients
  add column if not exists client_type text not null default 'persoana_fizica'
    check (client_type in ('persoana_fizica', 'persoana_juridica')),
  add column if not exists cui text,
  add column if not exists reg_com text;

-- Default editable markup (%) applied when registering parts from received supplier invoices
alter table public.tenants
  add column if not exists default_parts_markup_percent numeric(5,2) not null default 20;

-- Link an invoice to the vehicle it was issued for (client is derived from the vehicle on creation)
alter table public.invoices
  add column if not exists vehicle_id uuid references public.vehicles(id) on delete set null;

create index if not exists invoices_vehicle_id_idx on public.invoices(vehicle_id);

-- ============================================
-- SUPPLIERS (auto-registered by CUI from received e-Factura invoices)
-- ============================================
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  cui text not null,
  name text not null,
  address text,
  phone text,
  email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(tenant_id, cui)
);

create index if not exists suppliers_tenant_id_idx on public.suppliers(tenant_id);

alter table public.suppliers enable row level security;

create policy "suppliers_tenant_isolation" on public.suppliers
  for all using (tenant_id = (select tenant_id from public.profiles where id = auth.uid()))
  with check (tenant_id = (select tenant_id from public.profiles where id = auth.uid()));

create trigger set_updated_at before update on public.suppliers
  for each row execute function public.handle_updated_at();

-- ============================================
-- RECEIVED INVOICES (incoming e-Factura from suppliers, via ANAF SPV inbox)
-- ============================================
create table if not exists public.received_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  external_id text not null,              -- ANAF message id (idempotency key)
  number text,
  issued_at timestamptz,
  total numeric(10,2) not null default 0,
  status text not null default 'new' check (status in ('new', 'processed')),
  markup_percent_applied numeric(5,2),
  processed_at timestamptz,
  created_at timestamptz default now(),
  unique(tenant_id, external_id)
);

create index if not exists received_invoices_tenant_id_idx on public.received_invoices(tenant_id);
create index if not exists received_invoices_status_idx on public.received_invoices(tenant_id, status);

alter table public.received_invoices enable row level security;

create policy "received_invoices_tenant_isolation" on public.received_invoices
  for all using (tenant_id = (select tenant_id from public.profiles where id = auth.uid()))
  with check (tenant_id = (select tenant_id from public.profiles where id = auth.uid()));

-- ============================================
-- RECEIVED INVOICE ITEMS
-- ============================================
create table if not exists public.received_invoice_items (
  id uuid primary key default gen_random_uuid(),
  received_invoice_id uuid not null references public.received_invoices(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(10,2) not null,
  total numeric(10,2) not null,
  part_inventory_id uuid references public.part_inventory(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists received_invoice_items_invoice_id_idx on public.received_invoice_items(received_invoice_id);

alter table public.received_invoice_items enable row level security;

create policy "received_invoice_items_via_invoice" on public.received_invoice_items
  for all using (
    exists (
      select 1 from public.received_invoices
      where received_invoices.id = received_invoice_items.received_invoice_id
        and received_invoices.tenant_id = (select tenant_id from public.profiles where id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.received_invoices
      where received_invoices.id = received_invoice_items.received_invoice_id
        and received_invoices.tenant_id = (select tenant_id from public.profiles where id = auth.uid())
    )
  );

comment on table public.suppliers is 'Suppliers/distributors auto-registered by CUI from received e-Factura invoices';
comment on table public.received_invoices is 'Invoices received via ANAF e-Factura from suppliers (incoming, not issued by the tenant)';
comment on table public.received_invoice_items is 'Line items on a received supplier invoice';
comment on column public.tenants.default_parts_markup_percent is 'Default markup (%) applied to purchase_price to compute selling_price when registering parts from received invoices';
comment on column public.clients.client_type is 'persoana_fizica or persoana_juridica';
comment on column public.clients.cui is 'Fiscal code, only relevant for persoana_juridica clients';
