# NCCC — Codebase Status

Last updated: 2026-06-09 (Nightshift run)

---

## Current Phase

**Phase 8 complete, Phase 9 complete, Phase 10 partial.**

Phase 8 (taste recommendations, cellar, Want re-ranking, Winston voice rewrite) and
Phase 9 (Maker & Distillery pages, browse index) are both fully done.

Since 2026-05-31: the bourbon catalog is now source-of-truth managed via an editable
CSV (`data/catalog/bourbon-shelf.csv`) with `seed-catalog.ts` syncing to Supabase.
New catalog fields: `expression_type`, `tier`, `availability`, `price_usd`. Product
edit form and catalog card subtitle reflect these. A unified suggestion pipeline
(`lib/suggestions/`) and `WinstonSuggests` component were added to product detail.

An MCP server (`/api/[transport]`) and a Cloudflare OAuth proxy worker
(`workers/nccc-mcp-oauth-proxy/`) were added, exposing 9 Claude tools to external
AI clients.

Since 2026-06-01: a catalog scene-generator script (`scripts/media/generate-catalog-scenes.ts`,
`pnpm gen:catalog-scenes`) re-stages each catalog bourbon's photo into one of 8 curated
scenes via gpt-image-1 image-edit (stable hash assignment per product ID). Dry-run by
default; `--run` generates to `scripts/media/out/`. Scene upload back to Supabase is not
yet wired (IDEA-009, planned). A `catalog-scene-source-review.md` was added to
`scripts/media/` with Paul's allow/borderline/skip review for Tier 1 images.

Since 2026-06-02 (commit `3b1acfb`): `composeProductSubtitle` now emits availability
rarity (non-everyday only) and Cobb tier for bourbons. `suggestAdjacentProducts` computes
and returns `subtitle: string | null` on each `AdjacentProduct` result. `WinstonSuggests`
"Similar in tier" cards render the subtitle. `bourbon-shelf.csv` was comprehensively
updated with revised tier/availability/price_usd values. `AGENTS.md` added at repo root
(mirrors `CLAUDE.md` conventions for Codex/other agents). 5 new tests added for
`composeProductSubtitle`.

Since 2026-06-03 (commit `b1ac846`): FIX-015, FIX-016, and FIX-017 were all applied.
`group-validation.ts` now uses `formatMemberName()` for both `display_name` fields.
Scene generator validates `--size`/`--quality` against allowlists before passing to the API.
`loadReachForNext` now computes `subtitle` via `composeProductSubtitle` on shelf-scored objects,
unblocking the TypeScript build and unlocking IDEA-011 (subtitle in Reach for Next cards).

**Discrepancy note:** `docs/nightshift/plans/DEVPLAN-IDEA-006-pair-me-ux.md` exists from
a pre-nightshift session and describes the Pair-Me UX / WinstonSuggests feature (now
fully shipped as of 2026-06-01). The BACKLOG.md has IDEA-006 tracked as "MCP member
tastings tool" (seeded 2026-05-31, now parked). The plan file is orphaned documentation
of shipped work; IDEA-006 in the living backlog refers to the MCP tool idea.

---

## App Router Structure

```
apps/web/src/app/
  (auth)/
    login/               magic-link form
    accept-invite/       invite token → profile creation
  auth/callback/         Supabase magic-link exchange route
  (app)/
    (shell)/             layout.tsx — bottom nav + onboarding gate
      page.tsx           Feed (for-you | cigars | bourbons tabs)
      capture/           Photo capture → product identify → redirect
      products/[id]/     Product detail (group voice, Winston, pairings, cellar toggle)
        recommend/       Tasting capture form
        session/         Pairing-session tasting form
        edit/            Admin + creator product edit
        depth/           Extended flavor depth view
      pairings/
        [cigarId]/[bourbonId]/  Pairing detail page
        [cigarId]/[bourbonId]/taste/  Pair tasting form
        capture/         Manual pairing capture (cigar + bourbon picker)
      pick-pour/         Server action — picks a pairing from Have shelf
      makers/[slug]/     Maker/distillery detail (blurb, house_style, catalog) [Phase 9]
      members/           All members list
      members/[id]/      Member profile (tastings + cellar tabs)
      shelf/             Public-ish shelf browse
      search/            Product search
      you/               Personal hub
        page.tsx         Hub: badges, personal cards, admin link
        cellar/          Cellar + Tonight's Pick + Try Next recommendations
        tastings/        Full tastings history
        pairings/        Pairing history
        settings/        Avatar, display name, preferences
      admin/
        page.tsx         Admin index
        invites/         Invite management
        meetup/          Event creation/edit
        catalog/         Bourbon catalog_included toggles
        suggestions/     Member suggestions triage
      roadmap/           Member suggestions + roadmap view
      settings/          Preferences form (strengths, wrappers, proof, etc.)
      welcome/           Onboarding flow
  api/
    [transport]/         MCP server (Bearer-token auth, 9 tools + 5 prompts)
    enrich-draft/        POST — async catalog enrichment (Apify + OpenAI)
    product-photo/       POST/DELETE — admin photo management (sharp resize)
```

### MCP Server (`/api/[transport]`)

Exposed via `mcp-handler` library. Bearer token auth (`NCCC_MCP_TOKEN` env var). 9 tools:
- `search_products` — fuzzy catalog search
- `get_product` — product detail + club voice
- `suggest_pairings` — cross-category pairing scores + club validation
- `suggest_similar` — same-category alternatives by trait_vector
- `tonights_pick` — deterministic daily cigar+bourbon pick (same logic as feed Daily Pour)
- `get_my_cellar` — member's shelf inventory (have/want/tried/loved)
- `suggest_try_next` — palate-based buy list (same logic as Cellar Try Next)
- `get_club_feed` — recent club tastings and pairings
- `recommend` — one-shot: resolve name → pairings or similar

5 prompts: `try-next`, `club-pulse`, `tonights-pick`, `what-pairs`, `what-similar`

### Cloudflare OAuth Proxy Worker (`workers/nccc-mcp-oauth-proxy/`)

Cloudflare Worker providing OAuth 2.0 + PKCE authorization flow for Claude Desktop / MCP clients
that require OAuth rather than raw Bearer tokens. KV-backed token storage. Single ADMIN_SECRET
consent gate. Proxies authenticated requests to the Next.js MCP endpoint with the Bearer token.
Tested with Vitest.

---

## Features Built

### Core capture loop
- Photo capture → OpenAI GPT-5 mini vision → product identification
- Catalog match (existing product) vs. draft create (new product)
- Image stored in `product-photos` (private Supabase bucket)
- Signed URL passed to OpenAI (5-min TTL)
- Release label extraction (vision, member-editable)

### Enrichment pipeline
- Async via `api/enrich-draft` POST (separate 60s Vercel budget)
- Apify web scrape → reviews → `product_reviews` table
- OpenAI GPT-5 nano → `wheel_vector` from reviews
- `trait_vector` derived from `wheel_vector` (pairing engine input)
- `specs` fields filled from enrichment

### Tasting / recommendation flow
- `recommend/` form: yes/no + flavor chips + free note + release label
- Chips: instant synonym-mapped wheel vector (fallback, no LLM wait)
- LLM refinement: async GPT-5 nano wheel mapping, updates tasting row in place
- Upsert on `(user_id, product_id, release_label)` — separate rows per release
- `member_saves` (cellar): have / want / tried / loved signals
- `markTried` auto-fires after every tasting save

### Group voice / product detail
- `loadGroupVoice`: aggregates all tastings → tag_cloud, recommend count
- Winston prose: GPT-5 mini per product, cached in `products.winston_prose`, reroll by admin
- Pairing engine: cosine similarity on `trait_vector`, rules-based scoring (0-100)
- `pairings_cache`: upserted per page load when pairings are computed
- `checkGroupValidation`: marks moss-colored validated pairings
- Adjacent products: `suggestAdjacentProducts` via cosine on trait_vector

### WinstonSuggests — product detail suggestion pipeline

- `lib/suggestions/load-product-suggestions.ts`: unified pipeline for product detail.
  Runs `suggestShelfPairing` (shelf-first), `loadOrComputeTopPairings` (catalog),
  `loadReachForNext` (same-type similar from shelf then catalog), `ensureTasteRecommendations`
  (Hunt Next from palate model), `suggestAdjacentProducts` (similar in tier).
- `components/product/winston-suggests.tsx`: renders Try Tonight (brass CTA when
  shelf match), Hunt Next (TryNextPick rationale), Reach for Next (horizontal scroll),
  While Looking (Similar in Tier + Pairs Well With). Mounted below group voice on
  product detail.
- `lib/suggestions/rank.ts`: `sortClubValidatedFirst()`, `pairingIds()`.
- `lib/suggestions/types.ts`: `CrossTypePick`, `ReachForNextPick`, `ProductSuggestions`,
  `WhileLookingSuggestions`.

### Catalog CSV + seed pipeline

- `data/catalog/bourbon-shelf.csv` — authored shelf: one row per bottle, source of
  truth for `catalog_included`. Columns: `brand_family`, `expression`, `expression_type`,
  `name`, `is_core_range`, `tier`, `availability`, `price_usd`, `proof`, `abv`, `age`,
  `mash`, `spirit_type`, `producer`, `brand`, `id`.
- `scripts/seed/seed-catalog.ts` — idempotent sync: every sheet row → `catalog_included=true`,
  every off-sheet bourbon → `catalog_included=false`. Writes new UUIDs back into the CSV.
  Encoding guardrail: throws on U+FFFD (wrong-encoding artifacts) before any DB write.
- `expression_type` → `specs.expression_type` (Single Barrel, Small Batch, Barrel Proof…).
- `tier` (1–5 Cobb tier), `availability` (everyday/seasonal/allocated/lottery/…),
  `price_usd` → `specs.tier`, `specs.availability_rarity`, `specs.price_usd`.

### Product edit form (expanded)

`/products/[id]/edit` now exposes: name, brand, type, and per-type spec fields.
Bourbons: distillery, mash_bill, proof, age_label, tier (select), availability (select),
price_usd. Cigars: wrapper_color, country, vitola, strength, price_tier, price_usd.
Admin saves promote drafts to confirmed. RLS + app-layer auth check guards the action.
Second `products` select in the action fetches existing specs for merge (two round-trips
— documented trade-off for small user base).

### Cellar (personal) — Phase 8
- `member_saves`: have / want / tried / loved per member per product
- `CellarInsight`: GPT-5 nano reads the Have shelf, produces a 2-3 sentence Winston personality read per category. Cached in `users.cellar_insight`, keyed by `have_hash`.
- `TryNext` (Phase 8.1): cosine similarity on per-type taste vector → top 3 cigars + 3 bourbons. Cached in `users.taste_recommendations`, keyed by `signal_hash`.
- `rankWants` (Phase 8.2): re-ranks Want list by palate fit using same vector math. No cache — computed per page render.
- Winston rationale lines per Try Next pick: GPT-5 nano call, 6 picks → 6 lines (switched from mini as of 2026-05-30).
- **Tonight's Pick** (IDEA-001): `TonightsPickSection` on the cellar page — deterministic daily pick from Have shelf, rendered as a Winston voice line linking to the pairing page. Zero AI cost.

### Maker Pages — Phase 9
- `makers` table: slug, name, type, country, website, blurb (Winston prose), blurb_source, house_style, updated_at trigger.
- `ensureMaker()`: upsert-on-first-view — aggregates `trait_vector` across maker's products, derives `house_style` line, generates Winston blurb via GPT-5 mini on first render (cached in DB thereafter).
- `resolveMakerIdentity()`: looks up by slug, falls back to scanning products if not yet in `makers` table.
- Maker detail page at `/makers/[slug]`: header (name, country, website, house_style), Winston blurb, catalog section.
- Admin blurb edit + regenerate (guarded with `requireAdminUserId`).
- Brand name on product detail is now a link → `/makers/[makerSlug(brand)]`.
- Browse: `/makers` index (`?type=cigar|bourbon`), `/?tab=cigars|bourbons&view=makers`, filter-sheet + contextual links, clickable bourbon `brand_family` dividers → maker page.

### Feed
- `for-you` tab: Daily Pour card (deterministic from Have shelf), Find Your Next (Apify-enriched), tasting cards + pairing cards
- `cigars` / `bourbons` tabs: product catalog or houses view (`view=makers`); filters (strength, wrapper, proof, style, brand, club-only, enriched-only) and sorts on products view
- `forYou` flag per feed card: member preference match

### Pairing
- `suggestPairings`: score all catalog entries of opposite type vs. source trait_vector
- `suggestShelfPairing`: best opposite-type match from Have shelf only (shelf-first pick)
- `loadPickPourCandidates` + `selectPickPour`: deterministic daily pairing from Have shelf
- Validated pairings (group-tasted together): moss color via `pairing_sessions` table

### Members / social
- Member list (`/members`)
- Member profile: tastings + cellar tabs
- Badges: computed from tasting count, event attendance, Winston pairs
- Avatar upload (Supabase `avatars` bucket, signed URL for display)

### Admin
- Invite management (create / revoke)
- Meetup / event management
- Catalog inclusion toggle (bourbon `catalog_included`)
- Suggestion triage (status: open / reviewing / done / wont-do)
- Product photo management (catalog stock photo replace, member photo delete)
- Winston prose reroll

### AI / embeddings
- **GPT-5 mini** (`gpt-5-mini`): vision identification, Winston prose (product, pairing, cellar insight, taste rationale)
- **GPT-5 nano** (`gpt-5-nano`): chip→wheel mapping, review→wheel mapping
- **Replicate CLIP**: not yet wired in (referenced in plan, not in code)
- **pgvector**: not yet wired in (trait_vector stored as JSONB, cosine done in-process)
- Cost tracking: `usage_logs` table, `logUsage()` on every AI call

---

## Database Schema Summary

Tables (from migrations through 2026-05-30):
- `users`: id, name_first, name_last_initial, role, joined_at, avatar_url, onboarding_completed_at, cellar_insight (jsonb), taste_recommendations (jsonb)
- `invites`: single-use invite tokens
- `products`: id, type (cigar|bourbon), name, brand, line, source, image_url, specs (jsonb), status (draft|confirmed), wheel_vector (jsonb), trait_vector (jsonb), catalog_included, release_pattern, vintages_matter, winston_prose, created_by
- `tastings`: id, user_id, product_id, recommend, chips, note, wheel_vector, wheel_version, event_id, pairing_session_id, photo_image_id, release_label, release_year, release_label_source, release_kind, created_at
- `member_saves`: member_id, product_id, have, want, tried, loved (unique per member+product)
- `product_reviews`: catalog enrichment source data (Apify), extracted_vector
- `product_images`: member-contributed photos
- `pairings_cache`: (cigar_id, bourbon_id) → score, rationale_text, last_computed_at
- `pairing_sessions`: group pairing captures
- `events`: meetup events
- `suggestions`: member feature ideas / bug reports
- `usage_logs`: AI usage tracking
- `catalog_hierarchy`: brand family grouping for bourbon catalog (used for etched dividers)

RLS: all user-facing tables have RLS. Invites and suggestions are admin-gated at the DB level. `member_saves` is own-only. Products are readable by all authenticated members.

---

## Key Conventions in Use
- `formatMemberName(user)` → "First L" — single source at `lib/identity/`
- Flavor wheel: silent infrastructure only. Never sliders; only `tag_cloud` aggregate in UI.
- Brass = single primary action per screen.
- `<Voice />` and Winston: empty states, cellar insight, Try Next rationales, product prose, pairing prose. Never on capture form or feed tasting cards.
- Absolute imports `@/`. Type-only imports `import type`.
- Server Actions + `useActionState`. No form libraries.
- `cookies()` is async (Next.js 16). Always `await cookies()` in `createSupabaseServerClient`.
- Admin client (`createSupabaseAdminClient`) used only in API routes with prior auth check, seed scripts.

---

## What's NOT Built Yet
- Replicate CLIP embeddings (referenced, not wired)
- pgvector extension usage (trait_vector stored JSONB, cosine in JS)
- E2E Playwright tests (Vitest unit tests exist for lib/)
- MSW mocks for AI calls (tests use vitest mocks inline)
- Personal stats (Phase 8.4 in plan — not in commits)
- `/settings/usage` admin dashboard for cost tracking
- MCP `get_member_tastings` tool (IDEA-006, seed)
- Availability filter chip in bourbon catalog browse (IDEA-010, parked — plan written, reclaim when ready)
- "Reach for next" subtitle display in WinstonSuggests (IDEA-011, parked — plan written, 10 min to implement)
- Personal Hunt List on Cellar/You hub (IDEA-012, exploring)
- Club recommendation count badge on catalog cards (IDEA-013, parked — plan written, reclaim when ready)
- Meetup event day banner on feed (IDEA-014, planned — 30 min, zero cost, dev plan written)
- `YouMightAlsoLike` dead component cleanup (FIX-020, planned)
- Moss color in success states (FIX-019, planned — 5 files, all small swaps)
- Admin auth in roadmap suggestion actions (FIX-018, planned — same pattern as FIX-002)
- Storage leak on DB insert failure in `api/product-photo/route.ts` member upload path (FIX-021, planned — same class as FIX-003)
- Additional moss color violations in settings forms (FIX-022, planned — 4 more files: avatar-uploader, display-name-form, preferences-form, suggestion-form)
- Storage leak in pairing capture on sign/identify failure (FIX-023, planned — same class as FIX-003, plan written)
- UTC weekday mismatch in Tonight's Pick voice line (FIX-024, planned — 2-line fix in cellar page)
- UTC date in feed `today` variable causes meetup events to flip at 8pm EDT (FIX-025, planned — 1-line fix in page.tsx)
- Tonight's Pick empty-shelf Winston voice (IDEA-021, planned — 5 min, dev plan written)
- Admin product merge tool (IDEA-022, seed — ~2 hours, for duplicate product cleanup)
- Bourbon-specific explore links on product detail (IDEA-017, planned — 30 min, dev plan written)
- Native share sheet for product pages (IDEA-018, seed — `navigator.share()` PWA integration)
- Club want-count hint on Want shelf (IDEA-019, planned — 45 min, dev plan written)
- Branded error.tsx and not-found.tsx pages (IDEA-020, planned — 30 min, dev plan written)
- No `error.tsx` or `not-found.tsx` in the app — Next.js default pages shown on errors/404s
- IDEA-014 (meetup tonight banner) parked by stale rule — dev plan ready; apply FIX-025 first when reclaiming
- MCP single-token cross-member data access (FIX-026, planned — 5 min doc comment; full OAuth-scoped fix described in plan)
- `release_label` URL param lacks max-length guard in recommend page (FIX-027, planned — 1-line `.slice(0, 100)`)
- `<Voice />` used on capture form and pairing capture flow — design system violation (FIX-028, planned — 10 min, 3 sites)
- "Tasted by N of 12 members" count in ClubVoice group voice (IDEA-023, planned — 30 min, dev plan written)
- Quick Want-shelf toggle inline on catalog cards (IDEA-024, exploring — ~45 min once architecture questions resolved)
- Bourbon explore links (IDEA-017) and native share sheet (IDEA-018) parked — dev plan for IDEA-017 ready to reclaim
