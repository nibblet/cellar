-- Catalog expression collapse: parent expression on products, release variant on tastings.
-- See planning/catalog-expression-collapse.md.

-- ============================================================
-- products — expression-level metadata
-- ============================================================

alter table public.products
  add column vintages_matter boolean not null default false;

alter table public.products
  add column release_pattern text;

comment on column public.products.vintages_matter is
  'When true, product detail groups tastings by release_year. BTAC, Birthday Bourbon, Four Roses LE, etc.';
comment on column public.products.release_pattern is
  'UI hint for capture/recommend: year | batch | pick. Null = no release prompt.';

-- ============================================================
-- tastings — release variant captured inline
-- ============================================================

create type public.release_label_source as enum ('vision', 'member', 'migration');

alter table public.tastings
  add column release_label text;

alter table public.tastings
  add column release_year smallint;

alter table public.tastings
  add column release_label_source public.release_label_source;

comment on column public.tastings.release_label is
  'Free-text variant: "2021", "Batch 22F", "Justin''s House Pick". Optional.';
comment on column public.tastings.release_year is
  'Parsed from release_label when numeric. Enables year grouping without text parsing at query time.';
comment on column public.tastings.release_label_source is
  'Telemetry: vision | member | migration. Null when release_label is null.';

create index tastings_product_release_year_idx
  on public.tastings (product_id, release_year desc)
  where release_year is not null;

-- One tasting per member per expression per release label (empty label = expression-level).
alter table public.tastings
  add column release_label_key text
  generated always as (coalesce(release_label, '')) stored;

drop index if exists public.tastings_one_per_member_product;

create unique index tastings_one_per_member_product_release
  on public.tastings (user_id, product_id, release_label_key);
