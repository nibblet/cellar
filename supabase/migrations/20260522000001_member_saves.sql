-- Cellar v1: member_saves — Tried / Have / Want per (member, product).
--
-- Tried  = lifetime "I've had this". Sticky, member-controlled.
-- Have   = currently on my shelf / in my humidor.
-- Want   = wishlist.
--
-- Have and Want are mutually exclusive (CHECK constraint).
-- Have implies Tried — enforced in application code, not the DB, so members
-- can manually untoggle Tried without the DB rejecting the row.
-- Zero-state rows are deleted by application code rather than stored.

create table public.member_saves (
  member_id   uuid not null references public.users(id)    on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  have        boolean not null default false,
  want        boolean not null default false,
  tried       boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (member_id, product_id),
  constraint member_saves_have_want_mutex check (not (have and want))
);

-- Efficient per-member views for the Cellar tab.
create index member_saves_have_idx  on public.member_saves (member_id) where have;
create index member_saves_want_idx  on public.member_saves (member_id) where want;
create index member_saves_tried_idx on public.member_saves (member_id) where tried;

-- Used to find "who in the club has this" on product detail.
create index member_saves_product_idx on public.member_saves (product_id);

-- Refresh updated_at on every write.
create or replace function public.touch_member_saves_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger member_saves_updated_at
  before update on public.member_saves
  for each row execute function public.touch_member_saves_updated_at();

-- RLS: any authenticated NCCC member can read all rows (cellar browsing).
-- Only the owning member can write.
alter table public.member_saves enable row level security;

create policy member_saves_select_all
  on public.member_saves
  for select
  using (auth.role() = 'authenticated');

create policy member_saves_insert_own
  on public.member_saves
  for insert
  with check (auth.uid() = member_id);

create policy member_saves_update_own
  on public.member_saves
  for update
  using (auth.uid() = member_id)
  with check (auth.uid() = member_id);

create policy member_saves_delete_own
  on public.member_saves
  for delete
  using (auth.uid() = member_id);
