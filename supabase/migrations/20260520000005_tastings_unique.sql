-- Phase 3: a member has at most one tasting per product. Subsequent "recommend"
-- submissions update the existing row rather than appending duplicates.
--
-- Multi-occasion tracking (e.g., the same cigar smoked at two different events)
-- isn't a v1 concern — the latest impression is the relevant one for the group
-- voice. Revisit if members ask for it.

create unique index if not exists tastings_one_per_member_product
  on public.tastings (user_id, product_id);
