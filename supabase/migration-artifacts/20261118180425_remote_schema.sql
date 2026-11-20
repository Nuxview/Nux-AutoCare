SET local check_function_bodies = off;

DROP EVENT TRIGGER "ensure_rls";

DROP FUNCTION "public"."rls_auto_enable"();

DROP EXTENSION "hypopg";

DROP EXTENSION "index_advisor";

