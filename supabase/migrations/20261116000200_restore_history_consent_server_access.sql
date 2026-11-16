-- Only the server route that verifies vehicle ownership can change history consent.
revoke all on table public.vehicle_history_shares from public, anon, authenticated;
drop policy if exists vehicle_history_shares_tenant_isolation on public.vehicle_history_shares;
