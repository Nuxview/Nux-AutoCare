-- Staff role, branch and assignment checks run in server routes, not browser policies.
revoke all on table
  public.bookings, public.jobs, public.invoices, public.inventory_items,
  public.service_catalog, public.shops, public.payments, public.subscriptions,
  public.staff_invitations, public.audit_logs
from public, anon, authenticated;

drop policy if exists bookings_tenant_isolation on public.bookings;
drop policy if exists jobs_tenant_isolation on public.jobs;
drop policy if exists invoices_tenant_isolation on public.invoices;
drop policy if exists inventory_items_tenant_isolation on public.inventory_items;
drop policy if exists service_catalog_tenant_isolation on public.service_catalog;
drop policy if exists shops_tenant_isolation on public.shops;
drop policy if exists payments_tenant_read on public.payments;
drop policy if exists subscriptions_tenant_read on public.subscriptions;
drop policy if exists staff_invitations_tenant_read on public.staff_invitations;
drop policy if exists audit_logs_tenant_read on public.audit_logs;
