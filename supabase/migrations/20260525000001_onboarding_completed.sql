-- First-run onboarding gate (Tier 3 #17 expanded).
-- NULL = member has not finished /welcome. Backfill existing rows so launch members aren't gated.

alter table public.users
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.users.onboarding_completed_at is
  'Set when member finishes /welcome. NULL forces onboarding gate until complete.';

-- Existing members skip onboarding.
update public.users
set onboarding_completed_at = coalesce(onboarding_completed_at, joined_at)
where onboarding_completed_at is null;
