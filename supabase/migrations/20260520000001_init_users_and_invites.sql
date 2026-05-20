-- Phase 0: users + invites. Full schema (products, tastings, etc.) lands in Phase 1.

-- ============================================================
-- users
-- ============================================================

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name_first text not null,
  name_last_initial text not null check (char_length(name_last_initial) = 1),
  role text not null default 'member' check (role in ('member', 'admin')),
  joined_at timestamptz not null default now()
);

comment on table public.users is 'NCCC member profiles. One row per auth.users row.';
comment on column public.users.name_last_initial is 'Single uppercase letter. Combined with name_first as "First L" everywhere in UI.';

alter table public.users enable row level security;

-- Every authenticated member can read every member.
create policy "members can read all members"
  on public.users for select
  to authenticated
  using (true);

-- Members can update their own profile (not their role).
create policy "members can update own profile"
  on public.users for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.users where id = auth.uid()));

-- ============================================================
-- invites
-- ============================================================

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  email text,
  created_by uuid references public.users(id) on delete set null,
  used_by uuid references public.users(id) on delete set null,
  used_at timestamptz,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);

comment on table public.invites is 'Single-use invite tokens. Admins issue; new members redeem during signup.';

create index invites_token_idx on public.invites (token);
create index invites_unused_idx on public.invites (used_by) where used_by is null;

alter table public.invites enable row level security;

-- Only admins can read or create invites.
create policy "admins manage invites"
  on public.invites for all
  to authenticated
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

-- ============================================================
-- Helpers
-- ============================================================

-- Validate an invite token without exposing the invites table to anon users.
-- Returns the invite id if valid, null otherwise.
create or replace function public.validate_invite_token(token_param text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_id uuid;
begin
  select id into invite_id
  from public.invites
  where token = token_param
    and used_by is null
    and expires_at > now()
  limit 1;

  return invite_id;
end;
$$;

comment on function public.validate_invite_token is 'Anon-callable check that an invite token is valid (unused, unexpired). Returns invite id or null.';

-- Mark an invite as used by the calling auth user.
-- Called by the accept-invite flow after the user is created in auth.users.
create or replace function public.consume_invite_token(token_param text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_id uuid;
  invite_email text;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated to consume an invite';
  end if;

  select id, email into invite_id, invite_email
  from public.invites
  where token = token_param
    and used_by is null
    and expires_at > now()
  for update;

  if invite_id is null then
    raise exception 'invite token invalid, expired, or already used';
  end if;

  update public.invites
  set used_by = auth.uid(), used_at = now()
  where id = invite_id;

  return invite_id;
end;
$$;

comment on function public.consume_invite_token is 'Marks an invite token as used by the calling auth user. Must be called from a server action post-signup.';
