-- The personal humidor fork stores app data in the `cellar` schema.
-- Expose that schema through PostgREST and mirror Supabase's standard
-- API grants so authenticated app queries can read/write through RLS.

grant usage on schema cellar to anon, authenticated, service_role;

grant all on all tables in schema cellar to anon, authenticated, service_role;
grant all on all routines in schema cellar to anon, authenticated, service_role;
grant all on all sequences in schema cellar to anon, authenticated, service_role;

alter default privileges for role postgres in schema cellar
  grant all on tables to anon, authenticated, service_role;

alter default privileges for role postgres in schema cellar
  grant all on routines to anon, authenticated, service_role;

alter default privileges for role postgres in schema cellar
  grant all on sequences to anon, authenticated, service_role;

alter role authenticator
  set pgrst.db_schemas = 'public,storage,graphql_public,cellar';

notify pgrst, 'reload config';
notify pgrst, 'reload schema';
