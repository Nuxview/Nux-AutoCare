create function public.subscription_write_expiry(
  tenant_status text, trial_end timestamptz, paid_end timestamptz
) returns timestamptz
language sql immutable set search_path = '' as $$
  select case tenant_status when 'TRIAL' then trial_end when 'ACTIVE' then paid_end end;
$$;

create or replace function public.assert_tenant_writable(p_franchise_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  tenant_status text;
  expires_at timestamptz;
begin
  -- Hold the entitlement rows through the calling write transaction.
  select status into tenant_status from public.franchises
    where id = p_franchise_id for share;
  if tenant_status in ('SUSPENDED', 'CANCELLED') then
    raise exception 'TENANT_SUSPENDED';
  end if;

  select public.subscription_write_expiry(tenant_status, trial_ends_at, current_period_ends_at)
    into expires_at from public.subscriptions
    where franchise_id = p_franchise_id for share;
  if expires_at is null or expires_at <= clock_timestamp() then
    raise exception 'TENANT_READ_ONLY';
  end if;
end $$;

-- Filter the listing in PostgREST before limiting rows, without taking write locks.
create function public.shop_has_current_subscription(public.shops) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1
      from public.franchises f
      join public.subscriptions s on s.franchise_id = f.id
     where f.id = ($1).franchise_id
       and public.subscription_write_expiry(f.status, s.trial_ends_at, s.current_period_ends_at) > statement_timestamp()
  );
$$;

revoke all on function public.subscription_write_expiry(text, timestamptz, timestamptz),
  public.shop_has_current_subscription(public.shops) from public, anon, authenticated;
grant execute on function public.subscription_write_expiry(text, timestamptz, timestamptz),
  public.shop_has_current_subscription(public.shops) to service_role;
