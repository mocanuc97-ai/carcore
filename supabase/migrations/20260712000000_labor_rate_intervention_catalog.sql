-- Standard labor rate ("manoperă") used to auto-price a quick labor line
-- item when creating an invoice, editable per tenant in Settings.
alter table public.tenants
  add column if not exists labor_rate_per_hour numeric(10,2) not null default 150;

comment on column public.tenants.labor_rate_per_hour is 'Default RON/hour rate used to prefill a labor line item on invoices';

-- ============================================
-- INTERVENTION CATALOG (editable, per-tenant list of common intervention
-- types, shown as quick-pick suggestions when logging a new intervention —
-- most common first via sort_order)
-- ============================================
create table if not exists public.intervention_catalog (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  sort_order integer not null default 100,
  created_at timestamptz default now(),
  unique(tenant_id, name)
);

create index if not exists intervention_catalog_tenant_id_idx on public.intervention_catalog(tenant_id);

alter table public.intervention_catalog enable row level security;

create policy "intervention_catalog_tenant_isolation" on public.intervention_catalog
  for all using (tenant_id = (select tenant_id from public.profiles where id = auth.uid()))
  with check (tenant_id = (select tenant_id from public.profiles where id = auth.uid()));

grant select, insert, update, delete on public.intervention_catalog to authenticated, service_role;

comment on table public.intervention_catalog is 'Editable per-tenant catalog of common intervention types, most-used first, offered as quick-pick suggestions when logging a new intervention';

-- Seed every existing tenant with a starter catalog of common Romanian
-- auto-service intervention types (most frequent first). Shops can add/
-- remove entries afterward from the UI.
insert into public.intervention_catalog (tenant_id, name, sort_order)
select t.id, v.name, v.sort_order
from public.tenants t
cross join (values
  ('Schimb ulei motor + filtru', 10),
  ('Revizie completă (ulei, filtre, verificări)', 20),
  ('Schimb plăcuțe frână față', 30),
  ('Schimb plăcuțe frână spate', 40),
  ('Schimb discuri frână față', 50),
  ('Schimb discuri frână spate', 60),
  ('Schimb filtru aer', 70),
  ('Schimb filtru polen/habitaclu', 80),
  ('Schimb filtru combustibil', 90),
  ('Schimb baterie auto', 100),
  ('Schimb curea distribuție + rolă întinzător', 110),
  ('Schimb curea alternator/accesorii', 120),
  ('Schimb bujii', 130),
  ('Diagnoză computerizată', 140),
  ('Schimb amortizoare față', 150),
  ('Schimb amortizoare spate', 160),
  ('Geometrie roți (aliniere)', 170),
  ('Echilibrare roți', 180),
  ('Schimb anvelope (set 4)', 190),
  ('Reparație/vulcanizare anvelopă', 200),
  ('Schimb lichid frână', 210),
  ('Schimb lichid antigel/răcire', 220),
  ('Verificare/încărcare AC', 230),
  ('Schimb bec/lampă exterior', 240),
  ('Schimb ștergătoare parbriz', 250)
) as v(name, sort_order)
on conflict (tenant_id, name) do nothing;

-- Seed a broader reference table of services + realistic labor durations for
-- the Servicii & Prețuri page, for every tenant that doesn't already have a
-- service with the same name (so this never duplicates or clobbers anything
-- a shop already entered).
insert into public.services (tenant_id, name, price, duration_minutes, description)
select t.id, v.name, v.price, v.duration_minutes, v.description
from public.tenants t
cross join (values
  ('Schimb ulei motor + filtru ulei', 250.00, 45, 'Ulei motor sintetic + filtru ulei'),
  ('Revizie completă', 650.00, 120, 'Ulei, filtre, verificări generale, lichide'),
  ('Schimb plăcuțe frână față', 280.00, 60, 'Manoperă + montaj plăcuțe față'),
  ('Schimb plăcuțe frână spate', 260.00, 60, 'Manoperă + montaj plăcuțe spate'),
  ('Schimb discuri + plăcuțe frână față', 550.00, 90, 'Set complet față'),
  ('Schimb filtru aer', 60.00, 20, ''),
  ('Schimb filtru polen', 70.00, 20, ''),
  ('Schimb filtru combustibil', 120.00, 30, ''),
  ('Schimb baterie auto', 80.00, 20, 'Manoperă montaj baterie'),
  ('Schimb curea distribuție (kit complet)', 900.00, 240, 'Kit distribuție + pompă apă + manoperă'),
  ('Schimb bujii (set 4)', 150.00, 40, ''),
  ('Diagnoză computerizată', 120.00, 30, ''),
  ('Schimb amortizoare față (pereche)', 700.00, 90, ''),
  ('Schimb amortizoare spate (pereche)', 650.00, 90, ''),
  ('Geometrie roți', 150.00, 45, ''),
  ('Echilibrare roți (set 4)', 80.00, 30, ''),
  ('Montare + echilibrare anvelope (set 4)', 160.00, 60, ''),
  ('Vulcanizare roată', 80.00, 20, ''),
  ('Schimb lichid frână', 120.00, 30, ''),
  ('Schimb lichid antigel', 150.00, 40, ''),
  ('Verificare + încărcare freon AC', 200.00, 45, '')
) as v(name, price, duration_minutes, description)
where not exists (
  select 1 from public.services s
  where s.tenant_id = t.id and lower(s.name) = lower(v.name)
);
