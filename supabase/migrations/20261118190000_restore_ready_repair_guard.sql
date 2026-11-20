-- Restore the READY task guard after the recorded remote-schema snapshot.
create or replace function public.guard_approved_repair() returns trigger language plpgsql security invoker set search_path=public as $$
declare jid uuid; qid uuid; job_status text;
begin
 if tg_table_name='repair_tasks' then
  jid:=new.job_id;
  select current_quote_id,status into qid,job_status from jobs where id=jid for update;
  if job_status in ('COMPLETED','CANCELLED') then raise exception 'JOB_CLOSED'; end if;
  -- Check the locked current stage, not the task route's earlier access snapshot.
  if job_status='READY' and new.status<>'COMPLETED' then raise exception 'JOB_READY'; end if;
  if new.status='PENDING' then return new; end if;
 else
  if new.status not in ('IN_PROGRESS','QUALITY_CHECK','READY','COMPLETED') or new.status is not distinct from old.status then return new; end if;
  qid:=new.current_quote_id;
 end if;
 -- Existing invoiced repairs predate quote approvals. Preserve their handover workflow.
 if qid is null and exists(select 1 from invoices where job_id=case when tg_table_name='repair_tasks' then jid else new.id end) then return new; end if;
 if not exists(select 1 from repair_quotes where id=qid and status='APPROVED') then raise exception 'APPROVAL_REQUIRED'; end if;
 return new;
end $$;
