-- CarCore Core Tables Migration
-- Clients, Vehicles, Services, Interventions, Appointments, Invoices

-- ============================================
-- CLIENTS
-- ============================================
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  address text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists clients_tenant_id_idx on public.clients(tenant_id);
create index if not exists clients_phone_idx on public.clients(tenant_id, phone);

alter table public.clients enable row level security;

create policy "clients_tenant_isolation"
  on public.clients
  for all
  using (tenant_id = (select tenant_id from public.profiles where id = auth.uid()))
  with check (tenant_id = (select tenant_id from public.profiles where id = auth.uid()));

-- ============================================
-- VEHICLES
-- ============================================
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  make text not null,
  model text not null,
  year integer,
  vin text,                    -- serie de caroserie
  license_plate text,
  mileage integer,
  color text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists vehicles_tenant_id_idx on public.vehicles(tenant_id);
create index if not exists vehicles_client_id_idx on public.vehicles(client_id);
create index if not exists vehicles_vin_idx on public.vehicles(tenant_id, vin);

alter table public.vehicles enable row level security;

create policy "vehicles_tenant_isolation"
  on public.vehicles
  for all
  using (tenant_id = (select tenant_id from public.profiles where id = auth.uid()))
  with check (tenant_id = (select tenant_id from public.profiles where id = auth.uid()));

-- ============================================
-- SERVICES (predefined price list for quick invoicing)
-- ============================================
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  price numeric(10,2) not null default 0,
  duration_minutes integer,
  description text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists services_tenant_id_idx on public.services(tenant_id);

alter table public.services enable row level security;

create policy "services_tenant_isolation"
  on public.services
  for all
  using (tenant_id = (select tenant_id from public.profiles where id = auth.uid()))
  with check (tenant_id = (select tenant_id from public.profiles where id = auth.uid()));

-- ============================================
-- INTERVENTIONS (work history on vehicles)
-- ============================================
create table if not exists public.interventions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  description text not null,
  performed_at timestamptz default now(),
  photos text[] default '{}',     -- storage paths, 4-6 photos max
  total_price numeric(10,2),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists interventions_tenant_id_idx on public.interventions(tenant_id);
create index if not exists interventions_vehicle_id_idx on public.interventions(vehicle_id);
create index if not exists interventions_performed_at_idx on public.interventions(performed_at);

alter table public.interventions enable row level security;

create policy "interventions_tenant_isolation"
  on public.interventions
  for all
  using (tenant_id = (select tenant_id from public.profiles where id = auth.uid()))
  with check (tenant_id = (select tenant_id from public.profiles where id = auth.uid()));

-- ============================================
-- APPOINTMENTS
-- ============================================
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  scheduled_at timestamptz not null,
  status text not null default 'pending' 
    check (status in ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists appointments_tenant_id_idx on public.appointments(tenant_id);
create index if not exists appointments_scheduled_at_idx on public.appointments(tenant_id, scheduled_at);
create index if not exists appointments_status_idx on public.appointments(tenant_id, status);

alter table public.appointments enable row level security;

create policy "appointments_tenant_isolation"
  on public.appointments
  for all
  using (tenant_id = (select tenant_id from public.profiles where id = auth.uid()))
  with check (tenant_id = (select tenant_id from public.profiles where id = auth.uid()));

-- ============================================
-- INVOICES
-- ============================================
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  number text not null,                    -- e.g. FAC-2026-0001
  issued_at timestamptz default now(),
  due_at timestamptz,
  total numeric(10,2) not null default 0,
  pdf_url text,
  efactura_status text default 'pending' 
    check (efactura_status in ('pending', 'sent', 'accepted', 'rejected', 'error')),
  efactura_id text,                        -- reference from ANAF if available
  status text not null default 'draft' 
    check (status in ('draft', 'sent', 'paid', 'cancelled')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists invoices_tenant_id_idx on public.invoices(tenant_id);
create index if not exists invoices_client_id_idx on public.invoices(client_id);
create index if not exists invoices_number_idx on public.invoices(tenant_id, number);

alter table public.invoices enable row level security;

create policy "invoices_tenant_isolation"
  on public.invoices
  for all
  using (tenant_id = (select tenant_id from public.profiles where id = auth.uid()))
  with check (tenant_id = (select tenant_id from public.profiles where id = auth.uid()));

-- ============================================
-- INVOICE ITEMS (line items - link to predefined services or custom)
-- ============================================
create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  description text not null,
  quantity numeric(10,2) default 1,
  unit_price numeric(10,2) not null,
  total numeric(10,2) not null,
  created_at timestamptz default now()
);

create index if not exists invoice_items_invoice_id_idx on public.invoice_items(invoice_id);

alter table public.invoice_items enable row level security;

-- RLS for invoice_items through the parent invoice
create policy "invoice_items_via_invoice"
  on public.invoice_items
  for all
  using (
    exists (
      select 1 from public.invoices 
      where invoices.id = invoice_items.invoice_id 
        and invoices.tenant_id = (select tenant_id from public.profiles where id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.invoices 
      where invoices.id = invoice_items.invoice_id 
        and invoices.tenant_id = (select tenant_id from public.profiles where id = auth.uid())
    )
  );

-- ============================================
-- Updated at triggers (optional but useful)
-- ============================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply to tables that have updated_at
create trigger set_updated_at before update on public.clients for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.vehicles for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.services for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.interventions for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.appointments for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.invoices for each row execute function public.handle_updated_at();

-- ============================================
-- Comments for clarity
-- ============================================
comment on table public.clients is 'Clients of the auto service';
comment on table public.vehicles is 'Vehicles belonging to clients, with VIN (serie caroserie)';
comment on table public.services is 'Predefined services with prices for quick invoicing';
comment on table public.interventions is 'Work history / interventions on a vehicle (includes photos)';
comment on table public.appointments is 'Scheduled appointments / bookings';
comment on table public.invoices is 'Invoices with support for e-Factura';
comment on table public.invoice_items is 'Line items on an invoice';

-- Note: Full RLS + role-based policies (admin vs reception) will be refined in later migrations
-- For now we have strong tenant isolation.