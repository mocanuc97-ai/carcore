-- The new tables from the previous migration were created without the
-- standard Supabase default-privilege grants (unlike tables from earlier
-- migrations), causing "permission denied for table X" for every role,
-- including service_role, before RLS is even evaluated. Grant explicitly.
grant select, insert, update, delete on public.suppliers to authenticated, service_role;
grant select, insert, update, delete on public.received_invoices to authenticated, service_role;
grant select, insert, update, delete on public.received_invoice_items to authenticated, service_role;
