-- Catalog hierarchy: promote producer → brand_family → expression to
-- first-class, queryable columns, plus a reversible member-facing cut-back flag.
--
-- Backfilled by scripts/seed/backfill-catalog-spine.ts. Until that runs,
-- catalog_included defaults true so nothing disappears (non-breaking).

alter table public.products
  add column if not exists producer text,
  add column if not exists brand_family text,
  add column if not exists expression text,
  add column if not exists release_label text,
  add column if not exists is_core_range boolean not null default false,
  add column if not exists discontinued boolean not null default false,
  add column if not exists nas boolean not null default false,
  add column if not exists catalog_included boolean not null default true;

comment on column public.products.producer is 'Distillery / parent company (Jim Beam, Buffalo Trace). Normalized from the messy source distillery string.';
comment on column public.products.brand_family is 'Member-facing consumer brand (Knob Creek, Eagle Rare). One distillery can hold many.';
comment on column public.products.expression is 'Canonical SKU within the brand family (Small Batch, 12 Year). Near-duplicate source rows fold to one expression.';
comment on column public.products.release_label is 'Year / batch / pick that distinguishes a release within an expression. Null for the canonical bottling.';
comment on column public.products.is_core_range is 'Part of the brand''s standard always-on lineup (vs. limited / one-off).';
comment on column public.products.catalog_included is 'Shown in member-facing catalog browse. The cut-back hides the long tail here without deleting it — flip true to promote an individual bottle back.';

-- Browse groups by brand_family and filters on the cut-back flag.
create index if not exists products_catalog_browse_idx
  on public.products (type, catalog_included, brand_family);
create index if not exists products_brand_family_idx
  on public.products (brand_family) where brand_family is not null;
