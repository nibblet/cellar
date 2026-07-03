-- ============================================================================
-- Solo fork: isolated `cellar` schema in the SHARED Supabase project.
--
-- Clones the 13 NCCC catalog + personal tables into a dedicated `cellar`
-- schema (via LIKE INCLUDING ALL, so every accumulated column comes along),
-- re-adds FKs / triggers / RLS, then backfills:
--   * the full cigar + bourbon catalog (all rows)
--   * Paul Cobb's personal cellar (his saves / tastings / prefs / sessions)
--
-- The NCCC `public.*` tables are NEVER read-locked or altered — only SELECTed
-- from during backfill. Nothing here touches public.
--
-- The app points at this schema via `db: { schema: 'cellar' }`. You must also
-- add `cellar` to the project's exposed schemas (Dashboard → Settings → API →
-- "Exposed schemas") or PostgREST won't serve it.
--
-- Re-runnable: drops and rebuilds the cellar schema from scratch.
-- ============================================================================

drop schema if exists cellar cascade;
create schema cellar;

grant usage on schema cellar to anon, authenticated, service_role;
alter default privileges in schema cellar grant all on tables to anon, authenticated, service_role;

-- Paul Cobb — the sole user of the solo app.
-- (cf7290be-99e5-458f-aec7-71f3825107a4)

-- ── 1. Clone table structures ───────────────────────────────────────────────
-- LIKE INCLUDING ALL copies columns, defaults, PK/unique/check constraints,
-- indexes, generated columns, and comments. Foreign keys and RLS are NOT
-- copied — re-added below.

create table cellar.users             (like public.users             including all);
create table cellar.flavor_wheels     (like public.flavor_wheels     including all);
create table cellar.products          (like public.products          including all);
create table cellar.makers            (like public.makers            including all);
create table cellar.product_images    (like public.product_images    including all);
create table cellar.product_reviews   (like public.product_reviews   including all);
create table cellar.events            (like public.events            including all);
create table cellar.pairings_cache    (like public.pairings_cache    including all);
create table cellar.pairing_sessions  (like public.pairing_sessions  including all);
create table cellar.tastings          (like public.tastings          including all);
create table cellar.member_saves      (like public.member_saves      including all);
create table cellar.member_preferences(like public.member_preferences including all);
create table cellar.usage_logs        (like public.usage_logs        including all);

-- ── 2. Backfill data ────────────────────────────────────────────────────────
-- Order respects FK dependencies (FKs added afterward, but parents-first keeps
-- it clean). `select *` is safe because structures were just cloned exactly.

-- 2a. Sole user: Paul Cobb only.
insert into cellar.users
  select * from public.users where id = 'cf7290be-99e5-458f-aec7-71f3825107a4';

-- 2b. Catalog (shared reference data — all rows).
insert into cellar.flavor_wheels   select * from public.flavor_wheels;
insert into cellar.products        select * from public.products;
insert into cellar.makers          select * from public.makers;
insert into cellar.product_images  select * from public.product_images;
insert into cellar.product_reviews select * from public.product_reviews;
insert into cellar.pairings_cache  select * from public.pairings_cache;

-- 2c. Events (kept for tasting-night tagging; 1 row).
insert into cellar.events          select * from public.events;

-- 2d. Paul's personal data.
insert into cellar.member_preferences select * from public.member_preferences
  where user_id  = 'cf7290be-99e5-458f-aec7-71f3825107a4';
insert into cellar.member_saves       select * from public.member_saves
  where member_id = 'cf7290be-99e5-458f-aec7-71f3825107a4';
insert into cellar.pairing_sessions   select * from public.pairing_sessions
  where user_id  = 'cf7290be-99e5-458f-aec7-71f3825107a4';
insert into cellar.tastings           select * from public.tastings
  where user_id  = 'cf7290be-99e5-458f-aec7-71f3825107a4';
-- usage_logs intentionally left empty (fresh cost tracking).

-- ── 3. Null out cross-user attribution ──────────────────────────────────────
-- Catalog rows may reference other NCCC members in attribution columns. Only
-- Paul exists in cellar.users, so null the danglers before adding FKs.
update cellar.products       set created_by     = null
  where created_by     is not null and created_by     not in (select id from cellar.users);
update cellar.product_images set contributed_by = null
  where contributed_by is not null and contributed_by not in (select id from cellar.users);
update cellar.makers         set updated_by      = null
  where updated_by     is not null and updated_by      not in (select id from cellar.users);
update cellar.events         set host_user_id    = null
  where host_user_id   is not null and host_user_id    not in (select id from cellar.users);

-- ── 4. Defensive cache columns ──────────────────────────────────────────────
-- These were added to public.* by later migrations that may not have been
-- applied live. LIKE copies them if present; add-if-not-exists guarantees the
-- solo features (Winston prose, cellar insight, Try Next) have somewhere to write.
alter table cellar.users
  add column if not exists cellar_insight jsonb,
  add column if not exists taste_recommendations jsonb;
alter table cellar.products
  add column if not exists winston_prose jsonb,
  add column if not exists producer text,
  add column if not exists brand_family text,
  add column if not exists expression text,
  add column if not exists release_label text,
  add column if not exists is_core_range boolean not null default false,
  add column if not exists discontinued boolean not null default false,
  add column if not exists nas boolean not null default false,
  add column if not exists catalog_included boolean not null default true;
create index if not exists cellar_products_catalog_browse_idx
  on cellar.products (type, catalog_included, brand_family);

-- ── 5. Foreign keys (re-added, repointed within cellar) ──────────────────────
alter table cellar.users
  add constraint users_id_fkey foreign key (id) references auth.users(id) on delete cascade;

alter table cellar.products
  add constraint products_created_by_fkey foreign key (created_by) references cellar.users(id) on delete set null;

alter table cellar.makers
  add constraint makers_updated_by_fkey foreign key (updated_by) references cellar.users(id) on delete set null;

alter table cellar.product_images
  add constraint product_images_product_id_fkey foreign key (product_id) references cellar.products(id) on delete cascade,
  add constraint product_images_contributed_by_fkey foreign key (contributed_by) references cellar.users(id) on delete set null;

alter table cellar.product_reviews
  add constraint product_reviews_product_id_fkey foreign key (product_id) references cellar.products(id) on delete cascade;

alter table cellar.events
  add constraint events_host_user_id_fkey foreign key (host_user_id) references cellar.users(id) on delete set null;

alter table cellar.pairings_cache
  add constraint pairings_cache_cigar_id_fkey foreign key (cigar_id) references cellar.products(id) on delete cascade,
  add constraint pairings_cache_bourbon_id_fkey foreign key (bourbon_id) references cellar.products(id) on delete cascade;

alter table cellar.pairing_sessions
  add constraint pairing_sessions_user_id_fkey foreign key (user_id) references cellar.users(id) on delete cascade,
  add constraint pairing_sessions_cigar_id_fkey foreign key (cigar_id) references cellar.products(id) on delete cascade,
  add constraint pairing_sessions_bourbon_id_fkey foreign key (bourbon_id) references cellar.products(id) on delete cascade,
  add constraint pairing_sessions_event_id_fkey foreign key (event_id) references cellar.events(id) on delete set null;

alter table cellar.tastings
  add constraint tastings_user_id_fkey foreign key (user_id) references cellar.users(id) on delete cascade,
  add constraint tastings_product_id_fkey foreign key (product_id) references cellar.products(id) on delete cascade,
  add constraint tastings_event_id_fkey foreign key (event_id) references cellar.events(id) on delete set null,
  add constraint tastings_photo_image_id_fkey foreign key (photo_image_id) references cellar.product_images(id) on delete set null,
  add constraint tastings_pairing_session_fkey foreign key (pairing_session_id) references cellar.pairing_sessions(id) on delete set null;

alter table cellar.member_preferences
  add constraint member_preferences_user_id_fkey foreign key (user_id) references cellar.users(id) on delete cascade;

alter table cellar.member_saves
  add constraint member_saves_member_id_fkey foreign key (member_id) references cellar.users(id) on delete cascade,
  add constraint member_saves_product_id_fkey foreign key (product_id) references cellar.products(id) on delete cascade;

alter table cellar.usage_logs
  add constraint usage_logs_user_id_fkey foreign key (user_id) references cellar.users(id) on delete cascade;

-- ── 6. updated_at triggers ───────────────────────────────────────────────────
create function cellar.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_set_updated_at   before update on cellar.products
  for each row execute function cellar.set_updated_at();
create trigger member_saves_updated_at   before update on cellar.member_saves
  for each row execute function cellar.set_updated_at();
create trigger makers_updated_at         before update on cellar.makers
  for each row execute function cellar.set_updated_at();

-- ── 7. Row-level security (single-user) ──────────────────────────────────────
-- Catalog is readable + editable by the (sole) authenticated user; personal
-- tables are scoped to the owner. Any authenticated session is Paul.
alter table cellar.users              enable row level security;
alter table cellar.flavor_wheels      enable row level security;
alter table cellar.products           enable row level security;
alter table cellar.makers             enable row level security;
alter table cellar.product_images     enable row level security;
alter table cellar.product_reviews    enable row level security;
alter table cellar.events             enable row level security;
alter table cellar.pairings_cache     enable row level security;
alter table cellar.pairing_sessions   enable row level security;
alter table cellar.tastings           enable row level security;
alter table cellar.member_saves       enable row level security;
alter table cellar.member_preferences enable row level security;
alter table cellar.usage_logs         enable row level security;

-- Catalog / shared reference: any authenticated user (= Paul) reads + writes.
create policy cellar_all on cellar.flavor_wheels    for all to authenticated using (true) with check (true);
create policy cellar_all on cellar.products         for all to authenticated using (true) with check (true);
create policy cellar_all on cellar.makers           for all to authenticated using (true) with check (true);
create policy cellar_all on cellar.product_images   for all to authenticated using (true) with check (true);
create policy cellar_all on cellar.product_reviews  for all to authenticated using (true) with check (true);
create policy cellar_all on cellar.pairings_cache   for all to authenticated using (true) with check (true);
create policy cellar_all on cellar.events           for all to authenticated using (true) with check (true);

-- Own profile.
create policy cellar_users_self on cellar.users
  for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Personal tables: owner-scoped.
create policy cellar_own on cellar.tastings
  for all to authenticated using (auth.uid() = user_id)   with check (auth.uid() = user_id);
create policy cellar_own on cellar.member_saves
  for all to authenticated using (auth.uid() = member_id) with check (auth.uid() = member_id);
create policy cellar_own on cellar.member_preferences
  for all to authenticated using (auth.uid() = user_id)   with check (auth.uid() = user_id);
create policy cellar_own on cellar.pairing_sessions
  for all to authenticated using (auth.uid() = user_id)   with check (auth.uid() = user_id);
create policy cellar_own on cellar.usage_logs
  for all to authenticated using (auth.uid() = user_id)   with check (auth.uid() = user_id);

-- ── 8. Explicit grants (belt-and-suspenders alongside default privileges) ────
grant all on all tables in schema cellar to anon, authenticated, service_role;
