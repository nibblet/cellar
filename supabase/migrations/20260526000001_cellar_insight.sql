-- Add cached AI-generated cellar insight (Winston's read of the shelf).
-- Shape: { bourbons: string | null, cigars: string | null, generated_at: string, have_hash: string }
alter table public.users
  add column if not exists cellar_insight jsonb;

comment on column public.users.cellar_insight is
  'Cached Winston cellar insight. Keyed by have_hash so it regenerates when the shelf changes.';
