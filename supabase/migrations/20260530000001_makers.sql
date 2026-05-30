create table public.makers (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  type        text not null check (type in ('cigar', 'bourbon')),
  country     text,
  website     text,
  blurb       text,
  blurb_source text not null default 'ai' check (blurb_source in ('ai', 'manual')),
  house_style text,
  updated_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.makers is 'Cigar makers and bourbon distilleries. Blurb is AI-generated (Winston), editable by admin.';
comment on column public.makers.blurb_source is 'ai = regeneration allowed; manual = preserve admin edits';

create index makers_slug_idx on public.makers (slug);
create index makers_type_idx on public.makers (type);

alter table public.makers enable row level security;

create policy "members read makers"
  on public.makers for select
  to authenticated
  using (true);

create policy "admins manage makers"
  on public.makers for all
  to authenticated
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

create or replace function public.touch_makers_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger makers_updated_at
  before update on public.makers
  for each row execute function public.touch_makers_updated_at();
