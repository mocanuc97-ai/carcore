-- Allow a received_invoice to be marked 'error' when stock/purchase-record
-- registration fails partway through (previously the invoice could reach
-- 'processed' even when a write failed, since errors were never checked).
-- An 'error' invoice can be retried by an admin (processReceivedInvoice
-- accepts 'new' or 'error' as claimable states).
alter table public.received_invoices
  drop constraint if exists received_invoices_status_check;

alter table public.received_invoices
  add constraint received_invoices_status_check
  check (status in ('new', 'processed', 'error'));
