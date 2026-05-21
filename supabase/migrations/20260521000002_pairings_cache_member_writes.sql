-- Pairings cache has been shipped since Phase 6 with a SELECT-only RLS
-- policy. Every upsert from loadOrComputeTopPairings and the pair-detail
-- page's prose cache has been silently rejected under member auth.
--
-- The cache is shared club-wide (not per-member) and writes are append-only
-- + idempotent (onConflict: cigar_id,bourbon_id). Any authenticated member
-- can safely populate it.

create policy "members write pairing cache"
  on public.pairings_cache
  for insert
  with check (auth.uid() is not null);

create policy "members update pairing cache"
  on public.pairings_cache
  for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
