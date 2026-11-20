-- Operational writes require a current trial or paid term. Billing and customer
-- operations use their own authorization paths.
create function public.assert_tenant_writable(p_franchise_id uuid) returns void
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

  select case tenant_status when 'TRIAL' then trial_ends_at when 'ACTIVE' then current_period_ends_at end
    into expires_at from public.subscriptions
    where franchise_id = p_franchise_id for share;
  if expires_at is null or expires_at <= clock_timestamp() then
    raise exception 'TENANT_READ_ONLY';
  end if;
end $$;

revoke all on function public.assert_tenant_writable(uuid) from public, anon, authenticated;
grant execute on function public.assert_tenant_writable(uuid) to service_role;

create or replace function public.workshop_member(p_actor_id uuid,p_franchise_id uuid,p_shop_id uuid,p_roles text[]) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (
    select 1 from public.memberships m
    join public.franchises f on f.id = m.franchise_id
    join public.profiles p on p.id = m.user_id
    where m.user_id = p_actor_id and m.franchise_id = p_franchise_id
      and (m.shop_id is null or m.shop_id = p_shop_id)
      and m.is_active and p.is_active and m.role = any(p_roles)
      and f.status not in ('SUSPENDED','CANCELLED')
  ) then
    return false;
  end if;
  perform public.assert_tenant_writable(p_franchise_id);
  return true;
end $$;

create or replace function public.create_booking(
  p_customer_id uuid, p_shop_id uuid, p_vehicle_id uuid, p_service_id uuid, p_scheduled_at timestamptz, p_customer_notes text, p_reference text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_shop shops%rowtype; v_booking_id uuid; v_count integer; v_local timestamp; v_day text; v_hours jsonb;
begin
  if p_scheduled_at < now() + interval '1 hour' then raise exception 'INVALID_SCHEDULE'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_shop_id::text || p_scheduled_at::date::text, 0));
  select s.* into v_shop from shops s join franchises f on f.id=s.franchise_id where s.id=p_shop_id and s.is_active and s.accepts_bookings and f.status in ('TRIAL','ACTIVE');
  if not found then raise exception 'SHOP_NOT_FOUND'; end if;
  perform public.assert_tenant_writable(v_shop.franchise_id);
  v_local := p_scheduled_at at time zone v_shop.timezone;
  v_day := (array['sun','mon','tue','wed','thu','fri','sat'])[extract(dow from v_local)::integer + 1];
  v_hours := v_shop.opening_hours -> v_day;
  if v_hours is null or v_hours = 'null'::jsonb or (v_local::time < (v_hours->>'open')::time) or (v_local::time >= (v_hours->>'close')::time) then raise exception 'OUTSIDE_OPENING_HOURS'; end if;
  if not exists(select 1 from vehicles where id=p_vehicle_id and owner_id=p_customer_id) then raise exception 'VEHICLE_NOT_FOUND'; end if;
  if p_service_id is not null and not exists(select 1 from service_catalog where id=p_service_id and franchise_id=v_shop.franchise_id and is_active and (shop_id=p_shop_id or shop_id is null)) then raise exception 'INVALID_SERVICE'; end if;
  select count(*) into v_count from bookings where shop_id=p_shop_id and (scheduled_at at time zone v_shop.timezone)::date=v_local::date and status not in ('CANCELLED','DECLINED');
  if v_count >= v_shop.booking_capacity then raise exception 'CAPACITY_REACHED'; end if;
  insert into bookings(reference,franchise_id,shop_id,customer_id,vehicle_id,service_id,scheduled_at,customer_notes)
  values(p_reference,v_shop.franchise_id,p_shop_id,p_customer_id,p_vehicle_id,p_service_id,p_scheduled_at,p_customer_notes) returning id into v_booking_id;
  insert into notifications(user_id,title,body,type,data) values(p_customer_id,'Booking request sent',v_shop.name || ' will review booking ' || p_reference || '.','BOOKING_CREATED',jsonb_build_object('bookingId',v_booking_id));
  return v_booking_id;
end $$;

create or replace function public.decide_booking(p_booking_id uuid,p_actor_id uuid,p_decision text,p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v_booking bookings%rowtype;
begin
  if p_decision not in ('CONFIRMED','DECLINED') then raise exception 'INVALID_DECISION'; end if;
  select * into v_booking from bookings where id=p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  if v_booking.status <> 'REQUESTED' then raise exception 'BOOKING_ALREADY_REVIEWED'; end if;
  if not exists(select 1 from memberships where user_id=p_actor_id and franchise_id=v_booking.franchise_id and is_active and (shop_id is null or shop_id=v_booking.shop_id) and role in ('FRANCHISE_OWNER','FRANCHISE_ADMIN','SHOP_MANAGER','SERVICE_ADVISOR')) then raise exception 'FORBIDDEN'; end if;
  perform public.assert_tenant_writable(v_booking.franchise_id);
  update bookings set status=p_decision,decision_note=p_note where id=p_booking_id;
  insert into notifications(user_id,title,body,type,data) values(v_booking.customer_id,case when p_decision='CONFIRMED' then 'Booking approved' else 'Booking declined' end,case when p_decision='CONFIRMED' then 'Your garage visit is confirmed for ' || to_char(v_booking.scheduled_at at time zone 'Africa/Nairobi','DD Mon YYYY HH24:MI') || '.' else 'Your booking request was declined.' end,'BOOKING_DECIDED',jsonb_build_object('bookingId',p_booking_id,'status',p_decision));
  insert into audit_logs(actor_id,franchise_id,action,entity_type,entity_id) values(p_actor_id,v_booking.franchise_id,'BOOKING_' || p_decision,'Booking',p_booking_id);
end $$;

create or replace function public.create_job_from_booking(p_booking_id uuid, p_actor_id uuid, p_reference text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_booking bookings%rowtype; v_job_id uuid;
begin
  select * into v_booking from bookings where id=p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  perform public.assert_tenant_writable(v_booking.franchise_id);
  if exists(select 1 from jobs where booking_id=p_booking_id) then raise exception 'JOB_EXISTS'; end if;
  if v_booking.status not in ('CONFIRMED','CHECKED_IN') then raise exception 'INVALID_BOOKING_STATUS'; end if;
  insert into jobs(reference,franchise_id,shop_id,booking_id,customer_id,vehicle_id) values(p_reference,v_booking.franchise_id,v_booking.shop_id,v_booking.id,v_booking.customer_id,v_booking.vehicle_id) returning id into v_job_id;
  insert into job_stages(job_id,status,note) values(v_job_id,'OPEN','Job created from booking');
  update bookings set status='IN_PROGRESS' where id=p_booking_id;
  insert into audit_logs(actor_id,franchise_id,action,entity_type,entity_id,metadata) values(p_actor_id,v_booking.franchise_id,'JOB_CREATED','Job',v_job_id,jsonb_build_object('bookingId',p_booking_id));
  return v_job_id;
end $$;
