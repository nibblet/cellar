-- Phase 8.1: cache the member's personal "Try Next" recommendations.
--
-- Shape: {
--   cigars:   [{ product_id, name, brand, image_url, rationale }],
--   bourbons: [{ product_id, name, brand, image_url, rationale }],
--   signal_hash: string,   -- hash of tried/loved ids + preferences
--   generated_at: string
-- }
--
-- Keyed by signal_hash so it regenerates whenever the member's tried/loved
-- products or preferences change. Private: derived from the member's own
-- cellar, never club-facing.
alter table public.users
  add column if not exists taste_recommendations jsonb;

comment on column public.users.taste_recommendations is
  'Cached Try Next picks. Keyed by signal_hash so it regenerates when the member''s tried/loved products or preferences change.';
