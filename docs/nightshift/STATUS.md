# NCCC — Codebase Status

Last updated: 2026-05-31 (Nightshift run)

---

## Current Phase

**Phase 8 complete, Phase 9 partial.**

Phase 8 (taste recommendations, cellar, Want re-ranking, Winston voice rewrite) is fully done. Phase 9 (Maker & Distillery pages) landed as of 2026-05-30: maker detail pages exist at `/makers/[slug]`. A browse list at `/makers` is still missing (IDEA-005, planned).

An MCP server (`/api/[transport]`) and a Cloudflare OAuth proxy worker (`workers/nccc-mcp-oauth-proxy/`) were added, exposing 9 Claude tools to external AI clients.

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

### Cellar (personal) — Phase 8
- `member_saves`: have / want / tried / loved per member per product
- `CellarInsight`: GPT-5 nano reads the Have shelf, produces a 2-3 sentence Winston personality read per category. Cached in `users.cellar_insight`, keyed by `have_hash`.
- `TryNext` (Phase 8.1): cosine similarity on per-type taste vector → top 3 cigars + 3 bourbons. Cached in `users.taste_recommendations`, keyed by `signal_hash`.
- `rankWants` (Phase 8.2): re-ranks Want list by palate fit using same vector math. No cache — computed per page render.
- Winston rationale lines per Try Next pick: GPT-5 nano call, 6 picks → 6 lines (switched from mini as of 2026-05-30).
- **Tonight's Pick** (IDEA-001): `TonightsPickSection` on the cellar page — deterministic daily pick from Have shelf, rendered as a Winston voice line linking to the pairing page. Zero AI cost.

### Maker Pages — Phase 9 (partial)
- `makers` table: slug, name, type, country, website, blurb (Winston prose), blurb_source, house_style, updated_at trigger.
- `ensureMaker()`: upsert-on-first-view — aggregates `trait_vector` across maker's products, derives `house_style` line, generates Winston blurb via GPT-5 mini on first render (cached in DB thereafter).
- `resolveMakerIdentity()`: looks up by slug, falls back to scanning products if not yet in `makers` table.
- Maker detail page at `/makers/[slug]`: header (name, country, website, house_style), Winston blurb, catalog section.
- Admin blurb edit + regenerate (guarded with `requireAdminUserId`).
- Brand name on product detail is now a link → `/makers/[makerSlug(brand)]`.
- **Missing**: `/makers` browse list (IDEA-005, planned).

### Feed
- `for-you` tab: Daily Pour card (deterministic from Have shelf), Find Your Next (Apify-enriched), tasting cards + pairing cards
- `cigars` / `bourbons` tabs: catalog browse with filters (strength, wrapper, proof, style, brand, club-only, enriched-only) and sorts
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
- Phase 9: `/makers` browse list (detail pages exist; browse page does not)
- Replicate CLIP embeddings (referenced, not wired)
- pgvector extension usage (trait_vector stored JSONB, cosine in JS)
- E2E Playwright tests (Vitest unit tests exist for lib/)
- MSW mocks for AI calls (tests use vitest mocks inline)
- Personal stats (Phase 8.4 in plan — not in commits)
- `/settings/usage` admin dashboard for cost tracking
- MCP `get_member_tastings` tool (IDEA-006, seed)
