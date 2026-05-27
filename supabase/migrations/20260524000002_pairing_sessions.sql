-- WS3: Capture-a-Pairing join model. One row per paired capture; the two
-- tasting halves reference this id via tastings.pairing_session_id.

create table public.pairing_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  cigar_id uuid not null references public.products (id) on delete cascade,
  bourbon_id uuid not null references public.products (id) on delete cascade,
  pairing_note text,
  event_id uuid references public.events (id) on delete set null,
  photo_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pairing_sessions_user_created_idx
  on public.pairing_sessions (user_id, created_at desc);

create index pairing_sessions_pair_idx
  on public.pairing_sessions (cigar_id, bourbon_id);

alter table public.pairing_sessions enable row level security;

create policy "members read pairing sessions"
  on public.pairing_sessions for select
  to authenticated
  using (true);

create policy "members insert own pairing sessions"
  on public.pairing_sessions for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "members update own pairing sessions"
  on public.pairing_sessions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

comment on table public.pairing_sessions is
  'A member captured cigar + bourbon together via "Tasted this pairing".';

-- Orphan session ids (pre-table captures) cannot reference a parent row.
update public.tastings
set pairing_session_id = null
where pairing_session_id is not null;

alter table public.tastings
  drop constraint if exists tastings_pairing_session_fkey;

alter table public.tastings
  add constraint tastings_pairing_session_fkey
  foreign key (pairing_session_id) references public.pairing_sessions (id)
  on delete set null;
