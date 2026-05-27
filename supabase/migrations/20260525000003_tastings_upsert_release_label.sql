-- PostgREST cannot use generated columns in upsert on_conflict. Target
-- release_label directly; NULLS NOT DISTINCT treats null labels as equal
-- (expression-level tasting, same as coalesce(release_label, '') before).

drop index if exists public.tastings_one_per_member_product_release;

create unique index tastings_one_per_member_product_release
  on public.tastings (user_id, product_id, release_label) nulls not distinct;
