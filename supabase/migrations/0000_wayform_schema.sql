-- Wayform — dedicated `wayform` schema.
-- The app's Supabase client is configured with db.schema = 'wayform', so every
-- table it reads/writes must live here (auth and storage stay in their own
-- schemas). Run this FIRST, before the other migrations.
--
-- IMPORTANT: after running the migrations, expose this schema to the Data API:
--   Dashboard → Project Settings → API → "Exposed schemas" → add `wayform`.
-- Without that, the REST API cannot see these tables.

create schema if not exists wayform;

-- Let the API roles use the schema; row-level security still governs rows.
grant usage on schema wayform to anon, authenticated, service_role;

grant all on all tables in schema wayform to anon, authenticated, service_role;
grant all on all sequences in schema wayform to anon, authenticated, service_role;
grant all on all functions in schema wayform to anon, authenticated, service_role;

-- Apply the same grants to objects created by later migrations.
alter default privileges in schema wayform
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema wayform
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema wayform
  grant all on functions to anon, authenticated, service_role;
