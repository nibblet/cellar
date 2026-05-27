-- Tier 2 #24: max allocation tier visible on Cigars/Bourbons catalog (1–5).

alter table public.member_preferences
  add column max_catalog_tier integer not null default 2
  check (max_catalog_tier >= 1 and max_catalog_tier <= 5);

comment on column public.member_preferences.max_catalog_tier is
  'Catalog tabs show products with specs.tier <= this value. Unknown tier stays visible. 2 = common shelf, 5 = everything.';
