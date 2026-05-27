-- Suggestions: members send feature ideas + bug reports to Paul.
-- Surfaced on /roadmap (member-facing) and /admin/suggestions (admin view).

create table public.suggestions (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.users(id) on delete cascade,
  kind        text not null check (kind in ('feature', 'bug', 'other')),
  body        text not null check (length(body) between 1 and 4000),
  status      text not null default 'open'
              check (status in ('open', 'reviewing', 'done', 'wont-do')),
  admin_notes text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index suggestions_created_at_idx on public.suggestions (created_at desc);
create index suggestions_status_idx     on public.suggestions (status);
create index suggestions_member_idx     on public.suggestions (member_id);

create or replace function public.touch_suggestions_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger suggestions_updated_at
  before update on public.suggestions
  for each row execute function public.touch_suggestions_updated_at();

alter table public.suggestions enable row level security;

-- Members read + write their own. Admins read all and update status/notes.
create policy suggestions_select_own_or_admin
  on public.suggestions
  for select
  using (
    auth.uid() = member_id
    or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

create policy suggestions_insert_own
  on public.suggestions
  for insert
  with check (auth.uid() = member_id);

create policy suggestions_update_admin
  on public.suggestions
  for update
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

create policy suggestions_delete_admin
  on public.suggestions
  for delete
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));
