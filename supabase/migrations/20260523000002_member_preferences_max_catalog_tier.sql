-- Tier 2 #24: max allocation tier visible on Cigars/Bourbons catalog (1–5).

alter table public.member_preferences
  add column if not exists max_catalog_tier integer;

update public.member_preferences
  set max_catalog_tier = case when hide_rare then 2 else 5 end
  where max_catalog_tier is null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'member_preferences'
        and column_name = 'hide_rare'
    );

update public.member_preferences
  set max_catalog_tier = 2
  where max_catalog_tier is null;

alter table public.member_preferences
  alter column max_catalog_tier set default 2,
  alter column max_catalog_tier set not null;

alter table public.member_preferences
  drop constraint if exists member_preferences_max_catalog_tier_check;

alter table public.member_preferences
  add constraint member_preferences_max_catalog_tier_check
  check (max_catalog_tier >= 1 and max_catalog_tier <= 5);

alter table public.member_preferences
  drop column if exists hide_rare;

comment on column public.member_preferences.max_catalog_tier is
  'Catalog tabs show products with specs.tier <= this value. Unknown tier stays visible. 2 = common shelf, 5 = everything.';
