-- Tier 2 #5: member tasting + pairing preferences.
--
-- One row per member, positives-only. Empty arrays mean "Winston stays
-- neutral" — feature gates (e.g. the FOR YOU badge) only light when the
-- member has opted into at least one trait. There's no avoid list by design.

create table public.member_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,

  -- Cigar prefs
  cigar_strengths text[] not null default '{}',  -- mild | mild-medium | medium | medium-full | full
  cigar_wrappers  text[] not null default '{}',  -- connecticut | habano | maduro | san-andres | corojo | sumatra | cameroon | oscuro

  -- Bourbon prefs
  bourbon_styles      text[] not null default '{}', -- bourbon | rye | wheated | high-rye | bottled-in-bond | single-barrel
  bourbon_proof_bands text[] not null default '{}', -- low | mid | high

  updated_at timestamptz not null default now()
);

-- RLS: members read + write their own row only. Service role bypasses.
alter table public.member_preferences enable row level security;

create policy member_preferences_self_select
  on public.member_preferences
  for select
  using (auth.uid() = user_id);

create policy member_preferences_self_upsert
  on public.member_preferences
  for insert
  with check (auth.uid() = user_id);

create policy member_preferences_self_update
  on public.member_preferences
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
