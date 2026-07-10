-- Security fix: the vehicles RLS policy only checked vehicles.tenant_id on
-- write, never that vehicles.client_id actually belongs to a client of that
-- same tenant. This let a tenant attach another tenant's client_id to a
-- vehicle they own (confirmed via audit: addVehicleToClient trusts the
-- clientId argument without a tenant check, and RLS didn't catch it either).
-- A downstream invoice created from that vehicle would then derive an
-- unreadable cross-tenant client_id. Close the hole at the RLS layer so it
-- protects every current and future write path (CSV import, quick-add form,
-- the main vehicles page form), not just the one call site.
drop policy if exists "vehicles_tenant_isolation" on public.vehicles;

create policy "vehicles_tenant_isolation"
  on public.vehicles
  for all
  using (tenant_id = (select tenant_id from public.profiles where id = auth.uid()))
  with check (
    tenant_id = (select tenant_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.clients
      where clients.id = vehicles.client_id
        and clients.tenant_id = vehicles.tenant_id
    )
  );
