create function public.transition_repair_job(p_actor_id uuid,p_job_id uuid,p_status text) returns void
language plpgsql security invoker set search_path=public as $$
declare j jobs%rowtype; changed boolean; booking_status text;
begin
 if p_status is null or p_status not in ('IN_PROGRESS','READY','COMPLETED') then raise exception 'INVALID_STAGE_TRANSITION'; end if;
 -- Scheduling locks booking before job; use the same order to avoid a lock cycle.
 perform 1 from bookings where id=(select booking_id from jobs where id=p_job_id) for update;
 select * into j from jobs where id=p_job_id for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if not workshop_member(p_actor_id,j.franchise_id,j.shop_id,array['FRANCHISE_OWNER','FRANCHISE_ADMIN','SHOP_MANAGER','SERVICE_ADVISOR','MECHANIC']) then raise exception 'FORBIDDEN'; end if;
 if not workshop_member(p_actor_id,j.franchise_id,j.shop_id,array['FRANCHISE_OWNER','FRANCHISE_ADMIN','SHOP_MANAGER','SERVICE_ADVISOR']) and not exists(select 1 from memberships where id=j.assigned_mechanic_id and user_id=p_actor_id and is_active) then raise exception 'FORBIDDEN'; end if;
 changed:=j.status is distinct from p_status;
 if changed then
  if j.status in ('COMPLETED','CANCELLED') then raise exception 'JOB_CLOSED'; end if;
  if not ((p_status='IN_PROGRESS' and j.status in ('OPEN','DIAGNOSING','APPROVED','QUALITY_CHECK'))
   or (p_status='READY' and j.status in ('IN_PROGRESS','QUALITY_CHECK'))
   or (p_status='COMPLETED' and j.status='READY')) then raise exception 'INVALID_STAGE_TRANSITION'; end if;
 end if;
 if p_status in ('READY','COMPLETED') and (not exists(select 1 from repair_tasks where job_id=j.id)
  or exists(select 1 from repair_tasks where job_id=j.id and status<>'COMPLETED')) then raise exception 'TASKS_INCOMPLETE'; end if;
 -- The existing job trigger enforces current quote approval, including legacy invoices.
 if changed then
  update jobs set status=p_status,completed_at=case when p_status='COMPLETED' then now() else completed_at end where id=j.id;
 end if;
 booking_status:=case p_status when 'COMPLETED' then 'COMPLETED' when 'READY' then 'READY_FOR_COLLECTION' else 'IN_PROGRESS' end;
 update bookings set status=booking_status where id=j.booking_id and status is distinct from booking_status;
 -- Also recover side effects left missing by the old nontransactional handler.
 if p_status in ('READY','COMPLETED') and (changed or not exists(
  select 1 from notifications where user_id=j.customer_id and type='REPAIR_STATUS' and data->>'jobId'=j.id::text and data->>'status'=p_status
 )) then
  insert into notifications(user_id,title,body,type,data) values(j.customer_id,
   case when p_status='READY' then 'Vehicle ready for collection' else 'Repair completed' end,
   case when p_status='READY' then 'Your garage has completed the repair steps and your vehicle is ready.' else 'Your garage marked the repair as complete.' end,
   'REPAIR_STATUS',jsonb_build_object('jobId',j.id,'status',p_status));
 end if;
end $$;

revoke all on function public.transition_repair_job(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.transition_repair_job(uuid,uuid,text) to service_role;
