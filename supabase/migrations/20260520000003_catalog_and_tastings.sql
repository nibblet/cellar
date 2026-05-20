-- Phase 1: full catalog + tasting schema.
-- Adds: products, product_images, product_reviews, events, tastings, pairings_cache,
--       flavor_wheels, usage_logs.

-- ============================================================
-- Enums
-- ============================================================

create type public.product_type as enum ('cigar', 'bourbon');
create type public.product_status as enum ('draft', 'confirmed');
create type public.product_source as enum ('seed', 'ai', 'manual');

-- ============================================================
-- flavor_wheels
-- ============================================================

create table public.flavor_wheels (
  version text not null,
  type public.product_type not null,
  json jsonb not null,
  published_at timestamptz not null default now(),
  primary key (version, type)
);

comment on table public.flavor_wheels is 'Versioned snapshots of the cigar + bourbon flavor wheels. Tastings reference (wheel_version, type).';

alter table public.flavor_wheels enable row level security;

create policy "members can read flavor wheels"
  on public.flavor_wheels for select
  to authenticated
  using (true);

-- ============================================================
-- products
-- ============================================================

create table public.products (
  id uuid primary key default gen_random_uuid(),
  type public.product_type not null,
  name text not null,
  brand text,
  line text,
  image_url text,
  specs jsonb not null default '{}'::jsonb,
  wheel_version text,
  wheel_vector jsonb,
  trait_vector jsonb,
  status public.product_status not null default 'draft',
  source public.product_source not null default 'ai',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.products is 'Canonical catalog of cigars and bourbons. Draft rows are AI-suggested, awaiting member confirmation.';
comment on column public.products.specs is 'Type-specific structured data: wrapper/binder/filler/factory/vitola for cigars; mash bill/proof/age/distillery for bourbons.';
comment on column public.products.wheel_vector is 'Sparse flavor wheel scores: {leaf_id: 0-5, ...}. Derived from reviews (catalog) or LLM mapping (tastings).';
comment on column public.products.trait_vector is 'Normalized roll-up of wheel_vector to pairing traits: {trait: 0-1, ...}. Recomputed when wheel_vector changes.';

create index products_type_status_idx on public.products (type, status);
create index products_name_trgm_idx on public.products using gin (name gin_trgm_ops);
create index products_brand_trgm_idx on public.products using gin (brand gin_trgm_ops);
create index products_updated_at_idx on public.products (updated_at desc);

alter table public.products enable row level security;

create policy "members can read confirmed and own draft products"
  on public.products for select
  to authenticated
  using (status = 'confirmed' or created_by = auth.uid());

create policy "members can insert draft products"
  on public.products for insert
  to authenticated
  with check (auth.uid() is not null);

create policy "members can update their own draft products; admins update any"
  on public.products for update
  to authenticated
  using (
    created_by = auth.uid()
    or exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- Keep updated_at fresh on every row update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ============================================================
-- product_images
-- ============================================================

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  embedding vector(512),
  contributed_by uuid references public.users(id) on delete set null,
  is_hero boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.product_images is 'All photos for a product. CLIP embeddings power similarity search during identification.';
comment on column public.product_images.embedding is 'CLIP ViT-B/32 embedding (512-dim). Cosine similarity against this column drives photo-to-product matching.';
comment on column public.product_images.is_hero is 'At most one hero per product; renders as the product detail card image.';

create index product_images_product_idx on public.product_images (product_id);
-- HNSW index for fast cosine-similarity lookup during identification.
create index product_images_embedding_hnsw on public.product_images
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Only one hero per product.
create unique index product_images_one_hero_per_product
  on public.product_images (product_id) where is_hero;

alter table public.product_images enable row level security;

create policy "members can read product images"
  on public.product_images for select
  to authenticated
  using (true);

create policy "members can insert product images"
  on public.product_images for insert
  to authenticated
  with check (auth.uid() is not null);

-- ============================================================
-- product_reviews
-- ============================================================

create table public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  source text not null,
  source_url text,
  reviewer text,
  score integer,
  text text not null,
  extracted_vector jsonb,
  created_at timestamptz not null default now()
);

comment on table public.product_reviews is 'External reviews ingested during seeding (Halfwheel, Breaking Bourbon, etc). Used for descriptor extraction, not displayed to members.';
comment on column public.product_reviews.extracted_vector is 'Wheel vector derived from this review by gpt-5-nano. Aggregated into product.wheel_vector during enrichment.';

create index product_reviews_product_idx on public.product_reviews (product_id);
create index product_reviews_source_idx on public.product_reviews (source);

alter table public.product_reviews enable row level security;

-- Only admins read review prose (copyright caution). Aggregates flow through products.wheel_vector.
create policy "admins read product reviews"
  on public.product_reviews for select
  to authenticated
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

-- ============================================================
-- events (meetups)
-- ============================================================

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date date not null,
  host_user_id uuid references public.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

comment on table public.events is 'NCCC meetups. Tastings get optionally tagged to an event for the night-of-month recap view.';

create index events_date_idx on public.events (date desc);

alter table public.events enable row level security;

create policy "members can read all events"
  on public.events for select
  to authenticated
  using (true);

create policy "admins manage events"
  on public.events for all
  to authenticated
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

-- ============================================================
-- tastings
-- ============================================================

create table public.tastings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  recommend boolean not null,
  chips text[] not null default '{}'::text[],
  note text,
  wheel_version text not null,
  wheel_vector jsonb not null default '{}'::jsonb,
  photo_image_id uuid references public.product_images(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.tastings is 'One row per member-product-occasion. Primary action of the app: "Recommend to NCCC".';
comment on column public.tastings.recommend is 'Binary: would this member recommend it to the group? No stars, no scores.';
comment on column public.tastings.chips is 'Member-typed flavor descriptors (autocompleted from wheel but accepts free text).';
comment on column public.tastings.wheel_vector is 'LLM-derived sparse score map per wheel leaf. Silent infrastructure — never shown as sliders.';

create index tastings_product_idx on public.tastings (product_id);
create index tastings_user_idx on public.tastings (user_id);
create index tastings_event_idx on public.tastings (event_id) where event_id is not null;
create index tastings_created_at_idx on public.tastings (created_at desc);

alter table public.tastings enable row level security;

create policy "members read all tastings"
  on public.tastings for select
  to authenticated
  using (true);

create policy "members insert their own tastings"
  on public.tastings for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "members update their own tastings"
  on public.tastings for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "members delete their own tastings"
  on public.tastings for delete
  to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- pairings_cache
-- ============================================================

create table public.pairings_cache (
  cigar_id uuid not null references public.products(id) on delete cascade,
  bourbon_id uuid not null references public.products(id) on delete cascade,
  score numeric not null,
  rationale_text text,
  is_group_validated boolean not null default false,
  last_computed_at timestamptz not null default now(),
  primary key (cigar_id, bourbon_id)
);

comment on table public.pairings_cache is 'Top pairings precomputed by the rules engine; rationale prose written by gpt-5-mini and cached.';

create index pairings_cache_cigar_score_idx on public.pairings_cache (cigar_id, score desc);
create index pairings_cache_bourbon_score_idx on public.pairings_cache (bourbon_id, score desc);

alter table public.pairings_cache enable row level security;

create policy "members read pairing cache"
  on public.pairings_cache for select
  to authenticated
  using (true);

-- ============================================================
-- usage_logs (AI cost tracking)
-- ============================================================

create table public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  provider text not null,
  model text not null,
  operation text not null,
  units_in integer,
  units_out integer,
  cost_usd numeric(10, 6),
  metadata jsonb,
  created_at timestamptz not null default now()
);

comment on table public.usage_logs is 'Every paid API call (OpenAI, Replicate). Hard cap monitoring + per-operation cost analysis.';

create index usage_logs_created_at_idx on public.usage_logs (created_at desc);
create index usage_logs_provider_idx on public.usage_logs (provider, model);

alter table public.usage_logs enable row level security;

create policy "admins read usage logs"
  on public.usage_logs for select
  to authenticated
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));
