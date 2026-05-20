# NCCC — Implementation Plan

A phased build plan for the Norton Commons Cigar Club app. Each phase produces something usable end-to-end before the next begins. The goal is to get to a working capture-and-recommend flow as fast as possible, then layer the rest on top.

This plan is sized for a hobby app serving 12 friends — not a production SaaS. Where a choice is between "robust" and "simple," it picks simple. Where a choice is between "fancy" and "boring tech," it picks boring.

---

## Guiding principles

1. **Ship the capture loop first.** Nothing else matters until a member can snap a photo and recommend a cigar.
2. **The flavor wheel is invisible.** No sliders in any UI, ever. The wheel only surfaces as aggregated tag clouds.
3. **The group voice is the destination.** Every screen should make group sentiment easy to find.
4. **The Bartender is a tone, not a feature.** A small library of his lines, used consistently.
5. **Don't build for 12,000 users.** Build for 12. Skip rate limiting, queues, sharding, and similar machinery until something actually breaks.

---

## Tech choices (committed)

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 App Router, TypeScript | PWA-ready, server actions, file-based routing, Vercel-native. |
| Hosting | Vercel | Zero-config, free tier handles 12 users forever. |
| Database | Supabase Postgres | Free tier + integrated auth/storage/pgvector. |
| Auth | Supabase Auth (magic links) | No passwords. Invite-token gate on signup. |
| Storage | Supabase Storage | Original photos preserved; sepia is CSS-only. |
| Vector search | `pgvector` extension | Already in Supabase, no extra infra. |
| Image embeddings | OpenAI `text-embedding-3-small` for label OCR text + Replicate CLIP for image embeddings | Replicate's CLIP is the cheapest hosted option; alternatively self-host on Vercel cron if needed. |
| Vision identification | OpenAI **GPT-5 mini** (Vision + structured outputs) | Latest generation, strong vision, reasonable cost. |
| LLM mapper (chips/notes → wheel) | OpenAI **GPT-5 nano** with JSON mode | Cheapest current-gen model. Mapping is structurally simple; nano is sufficient. |
| Pairing prose generation | OpenAI **GPT-5 mini** | Quality matters more here than cost (it's the Bartender's voice). Cached per pair so we don't pay twice. |
| UI | Tailwind CSS + shadcn/ui primitives | Tailwind tokens map cleanly to our design system; shadcn for primitives we'll heavily customize. |
| Type fonts | `next/font/google` (Playfair Display, Inter) | First-class Next.js font handling, zero layout shift. |
| Forms/state | Server actions + React 19 `useActionState` | No form library needed at this scale. |
| Testing | Vitest (unit), Playwright (E2E), MSW (API mocks) | Standard, modern, low-friction. |
| Linting | Biome | Faster than ESLint+Prettier, single tool. |
| Env management | `.env.local` + Vercel env vars | No secrets manager needed. |

**Explicitly NOT using:** Prisma (Supabase types are sufficient), Redux/Zustand (server state is enough), Sentry (vercel logs are fine for 12 users), tRPC (server actions cover it).

---

## Repository layout

```
/Volumes/Lexar/NCCC/
├── apps/
│   └── web/                              # Next.js app
│       ├── src/
│       │   ├── app/                      # App Router routes
│       │   │   ├── (auth)/               # /login, /accept-invite
│       │   │   ├── (app)/                # authenticated app shell
│       │   │   │   ├── page.tsx          # feed
│       │   │   │   ├── capture/
│       │   │   │   ├── products/[id]/
│       │   │   │   ├── pairings/[cigarId]/[bourbonId]/
│       │   │   │   ├── members/[id]/
│       │   │   │   ├── events/[id]/
│       │   │   │   └── settings/
│       │   │   └── api/
│       │   │       ├── identify/         # POST photo → product
│       │   │       └── revalidate/
│       │   ├── components/               # UI components
│       │   │   ├── primitives/           # Button, Card, Chip, etc.
│       │   │   ├── bartender/            # Bartender voice + illustrations
│       │   │   ├── capture/              # Capture flow
│       │   │   ├── product/              # Product detail screens
│       │   │   ├── tasting/              # Tasting form & cards
│       │   │   └── pairing/              # Pairing UI
│       │   ├── lib/
│       │   │   ├── supabase/             # Server + client clients
│       │   │   ├── openai/               # API wrappers (identify, map, pair-prose)
│       │   │   ├── pairing/              # Pure rules engine (well-tested)
│       │   │   ├── wheel/                # Wheel loaders + vector helpers
│       │   │   ├── identity/             # formatMemberName(), avatars
│       │   │   └── voice/                # Bartender line library
│       │   ├── styles/
│       │   │   └── tokens.css            # CSS variables from design-system.md
│       │   └── types/
│       ├── public/
│       │   ├── logo/                     # NCCC logo + favicons
│       │   ├── bartender/                # Mascot illustration variants
│       │   └── manifest.webmanifest      # PWA manifest
│       ├── tests/
│       │   ├── unit/
│       │   ├── e2e/
│       │   └── fixtures/
│       └── package.json
├── data/
│   └── flavor-wheels/                    # (already exists)
├── docs/
│   └── design-system.md                  # (already exists)
├── planning/
│   ├── nccc-spec.md                      # (already exists)
│   └── nccc-implementation-plan.md       # this file
├── scripts/
│   ├── seed/
│   │   ├── seed-bourbons.ts              # bourbonExplorer → products
│   │   ├── seed-cigars.ts                # Halfwheel RSS + cigar-api → products
│   │   └── enrich-descriptors.ts         # one-time wheel-vector pass
│   └── ops/
│       └── reembed-products.ts           # regen image embeddings
├── supabase/
│   ├── migrations/                       # SQL migrations
│   └── functions/                        # Edge functions if needed (likely none in v1)
└── README.md
```

A single Next.js app inside `apps/web/` (monorepo-ready but not actually a monorepo yet — leaves room to add a mobile shell later without restructuring).

---

## Database schema (initial migrations)

```sql
-- 001_init.sql
create extension if not exists vector;
create extension if not exists pg_trgm;  -- fuzzy product name matching

create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  name_first text not null,
  name_last_initial text not null check (char_length(name_last_initial) = 1),
  role text not null default 'member' check (role in ('member', 'admin')),
  joined_at timestamptz not null default now()
);

create table invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  created_by uuid references users(id),
  used_by uuid references users(id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date date not null,
  host_user_id uuid references users(id),
  notes text,
  created_at timestamptz not null default now()
);

create type product_type as enum ('cigar', 'bourbon');
create type product_status as enum ('draft', 'confirmed');
create type product_source as enum ('seed', 'ai', 'manual');

create table products (
  id uuid primary key default gen_random_uuid(),
  type product_type not null,
  name text not null,
  brand text,
  line text,
  image_url text,                                  -- canonical hero image
  specs jsonb not null default '{}'::jsonb,        -- wrapper/mash bill/proof/etc.
  wheel_version text,                              -- e.g., '0.1'
  wheel_vector jsonb,                              -- {leaf_id: 0-5, ...}
  trait_vector jsonb,                              -- {trait: 0-1, ...} (computed)
  status product_status not null default 'draft',
  source product_source not null default 'ai',
  created_at timestamptz not null default now(),
  created_by uuid references users(id)
);
create index products_name_trgm on products using gin (name gin_trgm_ops);
create index products_type_status on products (type, status);

create table product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  image_url text not null,
  embedding vector(512),                           -- CLIP ViT-B/32 dimensionality
  contributed_by uuid references users(id),
  is_hero boolean not null default false,
  created_at timestamptz not null default now()
);
create index product_images_embedding on product_images using hnsw (embedding vector_cosine_ops);

create table product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  source text not null,                            -- 'halfwheel', 'breakingbourbon', 'reddit', etc.
  source_url text,
  text text not null,
  extracted_vector jsonb,
  created_at timestamptz not null default now()
);

create table tastings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  product_id uuid not null references products(id),
  event_id uuid references events(id),
  recommend boolean not null,
  chips text[] not null default '{}',
  note text,
  wheel_version text not null,
  wheel_vector jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index tastings_product on tastings (product_id);
create index tastings_user on tastings (user_id);
create index tastings_event on tastings (event_id);

create table pairings_cache (
  cigar_id uuid not null references products(id),
  bourbon_id uuid not null references products(id),
  score numeric not null,
  rationale_text text,
  is_group_validated boolean not null default false,
  last_computed_at timestamptz not null default now(),
  primary key (cigar_id, bourbon_id)
);

create table flavor_wheels (
  version text not null,
  type product_type not null,
  json jsonb not null,
  published_at timestamptz not null default now(),
  primary key (version, type)
);
```

**Row-level security (RLS):**
- All tables enabled.
- `users`, `tastings`, `products`, `events`, `product_images`, `product_reviews`: every authenticated user can SELECT. Only the row owner (or admin) can UPDATE/DELETE their own tastings.
- `invites`: only admins can SELECT/INSERT; the accept-invite flow validates the token via a SECURITY DEFINER function.
- This is the right granularity for a 12-person trusted club. Don't overthink it.

---

## Phases

Each phase is a complete, deployable slice. Don't move to phase N+1 until phase N is on Vercel and working.

### Phase 0 — Foundation (1–2 evenings)

**Goal:** Empty Next.js app with auth, design tokens, and PWA shell deployed to Vercel.

- [ ] `pnpm create next-app apps/web` (TypeScript, Tailwind, App Router, Biome)
- [ ] Set up Supabase project. Add `.env.local` with anon + service role keys.
- [ ] Run initial migration (just `users`, `invites`, `auth` plumbing).
- [ ] Wire Supabase server + client helpers (`lib/supabase/server.ts`, `lib/supabase/client.ts`).
- [ ] Implement magic-link login (`/login`) and invite-accept (`/accept-invite?token=...`).
- [ ] Translate `docs/design-system.md` tokens into `styles/tokens.css` and Tailwind config.
- [ ] Build primitive components: `Button`, `Card`, `Chip`, `Divider` (etched style), `MemberTag`.
- [ ] Add PWA manifest, app icons (use logo), service worker for installability.
- [ ] Add `formatMemberName(user)` to `lib/identity/`.
- [ ] Deploy to Vercel. Verify magic link works in production.

**Tests:**
- `formatMemberName` unit tests (handles two Pauls, empty last names, etc.)
- E2E: login flow, invite-accept flow, redirect to home

**Definition of done:** I can invite myself, click the link, see an empty "Welcome to NCCC" page styled in the design system.

---

### Phase 1 — Catalog seeding (1 evening)

**Goal:** Database populated with ~1,000 products. No UI yet; verify via Supabase studio.

- [ ] Migration: full schema from above (products, product_images, product_reviews, etc.)
- [ ] `scripts/seed/seed-bourbons.ts`: ingest bourbonExplorer JSON + makispl CSV → products with `source = 'seed'`.
- [ ] `scripts/seed/seed-cigars.ts`: parse Halfwheel RSS feed (last 3 years), ingest cigar-api.com → products.
- [ ] `scripts/seed/enrich-descriptors.ts`: for each product with review text, call GPT-4o-mini to extract a `wheel_vector`. Compute `trait_vector` from wheel + leaf trait mapping.
- [ ] Load the two wheel JSONs into the `flavor_wheels` table.

**Tests:**
- Vitest unit tests on the seeding parsers (sample fixtures from each source).
- The descriptor-enrichment LLM call is mocked in tests; sample real outputs are checked into `tests/fixtures/llm-responses/`.

**Definition of done:** `select count(*) from products where status = 'confirmed';` returns ~1,000. Spot-check 10 products in Supabase studio — names, specs, and wheel_vectors look correct.

---

### Phase 2 — Capture & identify (2–3 evenings)

**Goal:** Take a photo, see the product card materialize, view its specs. No social yet.

- [ ] `app/(app)/capture/page.tsx`: camera-first layout with cigar/bourbon toggle.
- [ ] Photo upload to Supabase Storage.
- [ ] `app/api/identify/route.ts`:
  1. Compute CLIP embedding (Replicate API).
  2. Vector search `product_images` (cosine similarity, threshold 0.85).
  3. If no match: call GPT-4o Vision with structured output → extract name/brand/specs.
  4. Fuzzy-match extracted name against `products` (`pg_trgm` similarity > 0.5).
  5. If match: link the photo's embedding to that product.
  6. If no match: create `products` row with `status='draft'` and AI's best guess.
  7. Return the product.
- [ ] Reveal screen UI (server component fetching product + group-voice aggregate).
- [ ] "Not quite right? Edit" link → simple edit form (name, brand, type, specs).

**Tests:**
- Unit: name-similarity matcher, embedding lookup with mocked pgvector results.
- E2E: upload a known cigar photo, verify it identifies (use a hard-coded fixture image + mocked OpenAI response).
- Manual: try 10 real photos from your humidor / bourbon shelf. Track accuracy.

**Definition of done:** I can stand at my desk, snap a Padron 1964 band, and within ~3 seconds see "PADRÓN 1964 ANNIVERSARY" with correct specs. Misses are gracefully editable.

---

### Phase 3 — Tasting flow (1–2 evenings)

**Goal:** Recommend + chips + note → tasting saved + wheel vector extracted silently.

- [ ] Reveal screen gains the brass "Recommend to NCCC" button.
- [ ] Optional layer: chip input (autocomplete from wheel leaves), free-text note.
- [ ] Server action `saveTasting`:
  1. Insert `tastings` row with `recommend`, `chips`, `note`.
  2. Async LLM call (GPT-4o-mini, JSON mode) to map chips + note → wheel_vector against the appropriate wheel.
  3. Update tasting with `wheel_vector` + `wheel_version`.
- [ ] Confirmation toast in The Bartender's voice.

**Tests:**
- Unit: chip-autocomplete matcher (synonyms work, "barnyard" finds `hay`).
- Unit: wheel-mapper prompt builder — given chips + note + wheel JSON, builds the correct prompt.
- Unit: response parser — invalid JSON falls back to chips-only mapping.
- E2E: full capture-to-tasting flow, mocked LLM, verify DB state.

**Definition of done:** A complete tasting takes 3 taps (shutter, confirm, recommend). With chips + note: 5 taps + a few words typed. The wheel vector lands in Postgres within a few seconds.

---

### Phase 4 — Product detail (group voice) — the destination screen (2 evenings)

**Goal:** The most important screen. The one we open mid-meetup.

- [ ] `app/(app)/products/[id]/page.tsx` server component.
- [ ] Sepia hero (best member-contributed image wins, fallback to seeded image_url).
- [ ] **THE CLUB SAYS** section:
  - Visceral recommend bar (custom SVG icon component: `CigarIcon` lit/dim, `GlencairnIcon` full/empty).
  - "N of M" caption.
  - Member takes list (collapsed after 3).
- [ ] **HOW IT TASTES** section:
  - Aggregate query: across all NCCC tastings of this product, sum wheel_vectors, rank leaves, render as size-weighted tag cloud.
- [ ] **PAIRS WITH** section: placeholder until phase 6.
- [ ] **THE FACTS** section: expandable specs.

**Tests:**
- Unit: aggregation query helpers (mock tastings → expected tag cloud).
- Unit: recommend-bar icon state logic.
- E2E: navigate to a product, see correct group voice rendered.
- Visual regression test (Playwright screenshot) on the reveal + product-detail layouts in light & dark.

**Definition of done:** A product with 6 tastings shows "6 of 8 recommend" + member takes + a tag cloud where "leather" and "cocoa" are visibly larger than "pepper." Matches the screen 2 sketch from prior work.

---

### Phase 5 — Feed, member profile, events (2 evenings)

**Goal:** Browsing what others had, between meetups.

- [ ] `app/(app)/page.tsx` — chronological feed of recent tastings. Filterable by member + event.
- [ ] Tasting card component: hero, product name, member tag, recommend indicator, chips, optional note.
- [ ] `app/(app)/members/[id]/page.tsx` — a member's tastings list + their most-recommended products.
- [ ] `app/(app)/events/[id]/page.tsx` — a meetup view, all tastings tagged to that event.
- [ ] Event creation (admin only): name, date, host.
- [ ] Tastings get an optional `event_id` selected from a recent-events list on the capture screen.

**Tests:**
- Unit: feed-filter query builders.
- E2E: filter feed by member, by event, verify results.

**Definition of done:** I'm at home Sunday morning, I open the app, I see what 3 guys logged at last night's meetup, I tap into Carl B's profile, I see his last 5 favorites.

---

### Phase 6 — The pairing engine (2–3 evenings)

**Goal:** Theoretical pairings work from day one; group-validated overlay improves over time.

- [ ] `lib/pairing/`:
  - `traits.ts`: roll up a `wheel_vector` to a `trait_vector` using the wheel JSON's leaf→traits mapping.
  - `rules.ts`: declarative rules (balance, harmony, conflict) over trait_vectors. Each rule outputs a delta score with a reason string.
  - `score.ts`: combine rules into a final 0–100 score per cigar/bourbon pair.
  - `engine.ts`: given a cigar id, return top 3 bourbon ids (and vice versa).
- [ ] `lib/voice/bartender.ts`: prompt template + GPT-4o-mini call to generate the prose "why" for each pairing. Cached in `pairings_cache.rationale_text`.
- [ ] Group-validated detection: a pairing is "group-validated" if ≥1 member has tasted both cigar and bourbon at the same event and recommended both.
- [ ] Background job (Vercel cron, weekly): recompute top pairings for all products that have new tastings since last computation. Cache in `pairings_cache`.
- [ ] `app/(app)/pairings/[cigarId]/[bourbonId]/page.tsx` — the dedicated pairing screen with Bartender intro + prose + club status.
- [ ] **PAIRS WITH** section on product detail wired up.

**Tests:**
- **Critical:** pairing rules are pure functions — unit-test them exhaustively. Each rule gets fixtures showing input trait_vectors → expected score delta + reason. This is the most testable part of the codebase; do it right.
- Unit: trait roll-up math (wheel_vector → trait_vector).
- Unit: group-validation detection.
- Snapshot test: given a fixed cigar profile, the top-3 bourbons are stable across runs.
- E2E: view a product's pairings, navigate to the pairing screen, see Bartender prose.

**Definition of done:** I can open Padron 1964's product page and see a Weller 12 pairing card with prose like "The cigar's cocoa and leather find a soft landing in Weller's wheated vanilla. A harmony, not a contrast." The reasoning matches what a thoughtful steward would actually say.

---

### Phase 7 — The Bartender, polish, admin (1–2 evenings)

**Goal:** Ship-ready.

- [ ] `lib/voice/lines.ts`: typed library of Bartender lines for empty states, errors, prompts, end-of-night. Use `<Voice />` component for consistent rendering (Playfair italic).
- [ ] Bartender illustration assets:
  - Splash variant (full-figure).
  - Header bust variant (used on pairing intro, empty states).
  - Single-hand-with-glass variant (small UI moments).
- [ ] All empty states audited and given Bartender voice.
- [ ] Settings page: edit name, view invite history.
- [ ] Admin: generate invites, edit any product, view all members.
- [ ] PWA install prompt + add-to-home-screen flow.
- [ ] Lighthouse pass: PWA, performance, accessibility all green.

**Tests:**
- E2E: full new-member journey (receive invite → magic link → first capture → recommend → see in feed).
- Visual regression on all primary screens, light and dark.

**Definition of done:** The app is on `nccc.app` (or similar). I send invite links to 11 friends. They install the PWA on their phones. We log a meetup that night.

---

## Cross-cutting concerns

### Testing strategy

- **Unit tests (Vitest):** every pure function in `lib/`. Especially `pairing/`, `wheel/`, `identity/`. Aim for >80% line coverage on `lib/` directories; don't bother chasing coverage in `components/` or `app/`.
- **E2E tests (Playwright):** golden-path flows only — invite-and-login, capture-and-recommend, view-product-and-pairings. Don't try to cover every screen.
- **MSW (Mock Service Worker):** mock OpenAI + Replicate calls in tests with fixtures from `tests/fixtures/`. Real API calls only in a `npm run test:integration` job that runs locally on demand.
- **No snapshot tests on JSX.** They rot. Use targeted assertions.
- **Visual regression (Playwright screenshots):** on 5–6 key screens. Light + dark mode.

### TDD discipline per phase

Each phase's test list above is the **test-first** scaffold. For each phase:
1. Write failing tests for the unit-level helpers first.
2. Write the implementation.
3. Write the E2E test once the implementation is hooked up.
4. Don't proceed to the next phase until tests + the manual definition-of-done both pass.

### CI / CD

- GitHub Actions workflow: lint (Biome), typecheck, unit tests on every PR.
- E2E tests run on PR against a Vercel preview deployment.
- Main branch auto-deploys to production via Vercel.
- Supabase migrations applied via `supabase db push` in a manual workflow (not auto — schema changes deserve human review).

### Cost monitoring

- Add a simple `usage_logs` table that records every OpenAI/Replicate call (model, tokens-or-units, cost-estimate).
- Tiny admin dashboard at `/settings/usage` shows running total.
- Set a Vercel + OpenAI hard cap of $20/month each in the dashboards. If we ever blow past that for 12 users, something is wrong.
- With GPT-5 nano on the wheel mapper (the high-frequency call), per-tasting AI cost should be ~$0.001. Identification (GPT-5 mini Vision + Replicate CLIP) is the bigger line at ~$0.02–0.03 per scan. At 100 tastings/month: well under $5/month total AI spend.

### Privacy & security floors

- All Supabase RLS policies are explicit. No table is publicly readable.
- OpenAI/Replicate calls go through server actions or route handlers — never expose API keys to the client.
- Photos in Supabase Storage are private; access via signed URLs only.
- No PII beyond first-name-last-initial. No emails displayed in UI.

### What we'll learn post-launch

- Cigar wheel mapper accuracy (user-flagged "cigars is harder than bourbon"). Plan a v0.2 wheel iteration after 30 days based on unmapped chip text.
- Identification accuracy on real-world boutique cigar bands. Expect 70-80% on first launch, rising as more photos accumulate.
- Whether the Bartender's voice lands or grates. Tunable in `lib/voice/lines.ts` without redeploy if hot-loaded; otherwise a small content change.
- Whether pairings feel useful before group data accumulates. We'll know in month 2.

---

## Timeline estimate (calendar weeks, evenings-only)

| Phase | Effort (evenings) | Cumulative weeks (2 evenings/wk) |
|---|---|---|
| 0 — Foundation | 2 | 1 |
| 1 — Catalog seeding | 1 | 1.5 |
| 2 — Capture & identify | 3 | 3 |
| 3 — Tasting flow | 2 | 4 |
| 4 — Product detail | 2 | 5 |
| 5 — Feed/profile/events | 2 | 6 |
| 6 — Pairing engine | 3 | 7.5 |
| 7 — Polish & Bartender | 2 | 8.5 |

**Roughly 8–9 calendar weeks** working evenings, give or take. Probably 50% longer in practice (life, debugging, design iterations) — so **call it ~14 weeks** from kickoff to ship.

A first internal-use-only deploy (phases 0–3) is doable in ~3 weeks. That's the first "actual milestone" — when you and 1-2 club friends can start logging real tastings, even before the group voice is fully realized.

---

## Project decisions (locked 2026-05-20)

- **Domain:** `nccc.forvex.app` eventually (user owns `forvex.app`). For now, ship on the Vercel-native preview/production URL. Custom domain swap is a 5-minute task whenever ready.
- **Hosting accounts:** User has existing Supabase project space and Vercel project space. We'll create new projects within those orgs rather than fresh accounts.
- **API keys:** User has OpenAI keys ready. Will provide securely (Vercel env vars, never committed).
- **OpenAI models:** GPT-5 mini for vision identification + pairing prose, GPT-5 nano for the chip→wheel mapper.
- **CLIP embedding host:** Replicate (default, ~$0.0005/call). Confirmed.
- **PWA install name:** "NCCC" (short, fits home-screen icon labels cleanly).
- **Editor environment:** Both Cursor and Claude Code in active use. Code conventions favor self-documenting names + clear TypeScript types over comments (works equally well for both AI assistants).
- **Repo:** GitHub private (to be created at phase 0 start). Name TBD — recommend `nccc-app`.

Phase 0 is unblocked. Ready to start.

---

*v1.0 · 2026-05-20 · Living document; will evolve as we hit reality.*
