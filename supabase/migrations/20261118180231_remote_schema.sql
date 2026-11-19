SET local check_function_bodies = off;

CREATE EXTENSION "hypopg" SCHEMA "extensions";

CREATE EXTENSION "index_advisor" SCHEMA "extensions";

CREATE OR REPLACE FUNCTION public.guard_approved_repair()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
declare jid uuid; qid uuid;
begin
 if tg_table_name='repair_tasks' then
  jid:=new.job_id;
  select current_quote_id into qid from jobs where id=jid for update;
  if exists(select 1 from jobs where id=jid and status in ('COMPLETED','CANCELLED')) then raise exception 'JOB_CLOSED'; end if;
  if new.status='PENDING' then return new; end if;
 else
  if new.status not in ('IN_PROGRESS','QUALITY_CHECK','READY','COMPLETED') or new.status is not distinct from old.status then return new; end if;
  qid:=new.current_quote_id;
 end if;
 -- Existing invoiced repairs predate quote approvals. Preserve their handover workflow.
 if qid is null and exists(select 1 from invoices where job_id=case when tg_table_name='repair_tasks' then jid else new.id end) then return new; end if;
 if not exists(select 1 from repair_quotes where id=qid and status='APPROVED') then raise exception 'APPROVAL_REQUIRED'; end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
  RETURNS event_trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog'
  AS $function$
DECLARE
  cmd record;
  tbl name;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        SELECT c.relname INTO tbl FROM pg_catalog.pg_class c WHERE c.oid = cmd.objid;
        EXECUTE format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM PUBLIC, "anon", "authenticated";

CREATE EVENT TRIGGER "ensure_rls"
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION "public"."rls_auto_enable"();

COMMENT ON EXTENSION "hypopg" IS 'Hypothetical indexes for PostgreSQL';

COMMENT ON EXTENSION "index_advisor" IS 'Query index advisor';

REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO "service_role";

