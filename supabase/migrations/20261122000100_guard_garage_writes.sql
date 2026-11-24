create function public.guard_garage_write() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  tenant_id uuid;
begin
  case tg_table_name
    when 'franchises' then
      tenant_id := new.id;
    when 'workshop_bays' then
      select franchise_id into tenant_id from public.shops
        where id = new.shop_id for share;
      if not found then return new; end if;
    else
      tenant_id := new.franchise_id;
  end case;
  perform public.assert_tenant_writable(tenant_id);
  return new;
end $$;

create trigger inventory_entitlement before insert or update on public.inventory_items
  for each row execute function public.guard_garage_write();
create trigger staff_invitation_entitlement before insert on public.staff_invitations
  for each row execute function public.guard_garage_write();
create trigger workshop_bay_entitlement before insert on public.workshop_bays
  for each row execute function public.guard_garage_write();
create trigger shop_settings_entitlement
  before update of name, accepts_bookings, opening_hours on public.shops
  for each row execute function public.guard_garage_write();
create trigger garage_profile_entitlement
  before update of name, logo_url on public.franchises
  for each row execute function public.guard_garage_write();

create function public.guard_repair_photo_write() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  tenant_id uuid;
  customer_id uuid;
begin
  select b.franchise_id, b.customer_id into tenant_id, customer_id
    from public.bookings b where b.id = new.booking_id for share;
  if found and new.uploaded_by is distinct from customer_id then
    perform public.assert_tenant_writable(tenant_id);
  end if;
  return new;
end $$;

create trigger repair_photo_entitlement before insert on public.repair_photos
  for each row execute function public.guard_repair_photo_write();

create or replace function public.guard_approved_repair() returns trigger
language plpgsql security invoker set search_path = public as $$
declare jid uuid; qid uuid; job_status text; tenant_id uuid;
begin
 if tg_table_name='repair_tasks' then
  jid:=new.job_id;
  select current_quote_id,status,franchise_id into qid,job_status,tenant_id
    from jobs where id=jid for update;
  if not found then return new; end if;
  perform public.assert_tenant_writable(tenant_id);
  if job_status in ('COMPLETED','CANCELLED') then raise exception 'JOB_CLOSED'; end if;
  if job_status='READY' and new.status<>'COMPLETED' then raise exception 'JOB_READY'; end if;
  if new.status='PENDING' then return new; end if;
 else
  if new.status not in ('IN_PROGRESS','QUALITY_CHECK','READY','COMPLETED') or new.status is not distinct from old.status then return new; end if;
  qid:=new.current_quote_id;
 end if;
 -- Existing invoiced repairs predate quote approvals.
 if qid is null and exists(select 1 from invoices where job_id=case when tg_table_name='repair_tasks' then jid else new.id end) then return new; end if;
 if not exists(select 1 from repair_quotes where id=qid and status='APPROVED') then raise exception 'APPROVAL_REQUIRED'; end if;
 return new;
end $$;

create function public.save_garage_settings(
  p_franchise_id uuid, p_shop_id uuid, p_name text, p_accepts_bookings boolean,
  p_opening_hours jsonb, p_franchise_name text
) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  -- Match booking lock order and take the garage's write lock before the guard
  -- takes a shared lock, so concurrent name changes never need a lock upgrade.
  perform 1 from public.shops
    where id = p_shop_id and franchise_id = p_franchise_id for no key update;
  if not found then raise exception 'SHOP_NOT_FOUND'; end if;
  if p_franchise_name is not null then
    perform 1 from public.franchises where id = p_franchise_id for no key update;
  end if;

  update public.shops set name = p_name, accepts_bookings = p_accepts_bookings,
    opening_hours = p_opening_hours where id = p_shop_id;
  if p_franchise_name is not null then
    update public.franchises set name = p_franchise_name where id = p_franchise_id;
  end if;
end $$;

create function public.update_repair_task(
  p_task_id uuid, p_job_id uuid, p_status text, p_note text
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  task public.repair_tasks%rowtype;
begin
  update public.repair_tasks
    set status = p_status, note = coalesce(p_note, note)
    where id = p_task_id and job_id = p_job_id returning * into task;
  if not found then raise exception 'TASK_NOT_FOUND'; end if;

  -- The task trigger already holds the job and entitlement locks.
  update public.jobs set updated_at = now(),
    status = case when p_status = 'IN_PROGRESS' and status in ('OPEN', 'APPROVED')
      then 'IN_PROGRESS' else status end
    where id = p_job_id;
  return to_jsonb(task);
end $$;

revoke all on function public.guard_garage_write(), public.guard_repair_photo_write(),
  public.save_garage_settings(uuid, uuid, text, boolean, jsonb, text),
  public.update_repair_task(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.save_garage_settings(uuid, uuid, text, boolean, jsonb, text),
  public.update_repair_task(uuid, uuid, text, text) to service_role;
