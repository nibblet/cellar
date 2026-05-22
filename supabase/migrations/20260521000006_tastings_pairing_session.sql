-- "Tasted this pairing" creates two tastings (one per product) in a single
-- capture. They share a pairing_session_id so the feed can render them as
-- a single linked card later, and so we can audit / undo the pair as a unit.
--
-- Nullable on purpose: standalone tastings (the existing flow) don't carry a
-- session id. The constraint is just that the two halves of a pair share one.

alter table public.tastings
  add column if not exists pairing_session_id uuid default null;

create index if not exists tastings_pairing_session_idx
  on public.tastings (pairing_session_id)
  where pairing_session_id is not null;

comment on column public.tastings.pairing_session_id is
  'Groups two tastings (one cigar, one bourbon) captured together via the "Tasted this pairing" flow. Null for standalone tastings.';
