-- Classify a tasting's release label (store pick / private selection / batch /
-- vintage). The specific bottling stays a tag on the primary expression's
-- tasting — not a separate catalog row — so this just types that tag.

alter table public.tastings
  add column if not exists release_kind text;

comment on column public.tastings.release_kind is 'Kind of this release: store-pick | private-selection | batch | vintage. Derived from release_label at save time; null when unclassifiable.';
