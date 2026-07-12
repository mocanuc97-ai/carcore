-- The case-sensitive unique(tenant_id, name) constraint let "Test" and
-- "TEST" both be inserted as separate rows (Postgres text equality is
-- case-sensitive by default) — found via QA testing. Replace it with a
-- case-insensitive unique index so a duplicate name in any case raises the
-- same 23505 conflict the app already handles gracefully.
alter table public.intervention_catalog drop constraint if exists intervention_catalog_tenant_id_name_key;

create unique index if not exists intervention_catalog_tenant_id_name_ci_idx
  on public.intervention_catalog (tenant_id, lower(name));
