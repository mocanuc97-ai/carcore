-- The e-Factura simulation/polling code (lib/efactura/stub.ts) uses
-- 'in_processing' as an intermediate status, but the original CHECK
-- constraint never allowed it — every "Trimite ANAF" / poll status update
-- was silently rejected by Postgres, so efactura_status never left
-- 'pending' despite the UI reporting success. Found via QA browser testing.

do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'public.invoices'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%efactura_status%';

  if con_name is not null then
    execute format('alter table public.invoices drop constraint %I', con_name);
  end if;
end $$;

alter table public.invoices
  add constraint invoices_efactura_status_check
  check (efactura_status in ('pending', 'sent', 'in_processing', 'accepted', 'rejected', 'error'));
