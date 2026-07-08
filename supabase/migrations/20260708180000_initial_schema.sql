-- CarCore Initial Schema
-- Multi-tenant foundation for auto service management

-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Tenants (each auto service / workshop)
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  logo_url text,
  phone text,
  email text,
  address text,
  created_at timestamptz default now()
);

-- Profiles (users linked to a tenant)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin', 'reception')),
  email text not null,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.tenants enable row level security;
alter table public.profiles enable row level security;

-- Basic policies (will be refined)
create policy "Users can view their own tenant"
  on public.tenants for select
  using (id in (select tenant_id from public.profiles where id = auth.uid()));

create policy "Users can view their own profile"
  on public.profiles for select
  using (id = auth.uid());

-- More tables will be added in later migrations (clients, vehicles, interventions, etc.)

comment on table public.tenants is 'Each auto service / workshop is a tenant';
comment on table public.profiles is 'Users (admin or reception) belonging to a tenant';
