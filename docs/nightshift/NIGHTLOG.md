# NCCC Nightshift Log

Append-only. Most recent run at top.

---

## Run: 2026-06-01

### Summary
- Scanned: 14 commits since last nightshift — catalog CSV source-of-truth pipeline,
  product edit form expansion, WinstonSuggests on product detail, member preferences
  fix, expression_type + tier/availability/price_usd CSV columns, brand-spine grouping
- Issues: 6 new (FIX-009 through FIX-014), 0 existing open, 0 newly resolved
- Ideas: 2 new (IDEA-007 → immediately planned, IDEA-008 → seed); 2 parked (IDEA-002,
  IDEA-004 hit 3-day stale rule); IDEA-006 reviewed, not yet stale
- Plans written: 6 fix plans + 1 devplan (7 total)
- Tests: 425 passing, 0 failures
- Lint: 71 errors (26 auto-fixable format/imports; 6 genuine — documented as FIX-009/014)

### Key Findings
- **Catalog CSV pipeline is solid.** `data/catalog/bourbon-shelf.csv` → `seed-catalog.ts`
  → Supabase is a clean, idempotent, audit-friendly approach. Encoding guardrail (U+FFFD
  check before write) is a good defensive touch. No issues with the pipeline itself.
- **WinstonSuggests is the biggest new surface** — a unified suggestion panel on product
  detail with Try Tonight (shelf-first), Hunt Next (palate model), Reach for Next (same-type
  similar), and While Looking (similar in tier). Clean architecture in `lib/suggestions/`.
  No bugs found; performance is acceptable (queries run in `Promise.all`).
- **6 lint errors, all small, all planned.** FIX-009/010: unused imports (1-line each).
  FIX-011/012: dead function + dead constant (delete-only). FIX-013/014: Biome a11y
  over-generalization on `role="group"` — biome-ignore is the correct fix since
  `<fieldset>` is wrong for button and link groups.
- **availability_rarity + tier are invisible** — the CSV seed populates these, the edit
  form captures them, but `composeProductSubtitle` doesn't emit them. Members browsing
  the Bourbons catalog can't see "Allocated" or "Tier 4" without opening each product.
  IDEA-007 fixes this in ~1 hour with zero DB changes.
- **3-day stale rule triggered** for IDEA-002 (badge milestone) and IDEA-004 (personal
  stats). Both parked with notes. Neither is urgent for the 12-member group.

### Plans Ready to Execute
- `docs/nightshift/plans/FIXPLAN-FIX-009-unused-import-tag-cloud-entry.md` — 1-line: remove `TagCloudEntry` from import in `club-says-prose.ts`
- `docs/nightshift/plans/FIXPLAN-FIX-010-unused-import-enrich-index.md` — 1-line: remove local import of `productNeedsCatalogEnrichment` in `enrich/index.ts`
- `docs/nightshift/plans/FIXPLAN-FIX-011-dead-function-strip-brand-prefix.md` — 5-line deletion: remove dead `stripBrandPrefix` from `catalog-name-cleanup.ts`
- `docs/nightshift/plans/FIXPLAN-FIX-012-dead-constant-vintages-matter.md` — delete deprecated empty array + `let` → `const` in `expression-normalize.ts`
- `docs/nightshift/plans/FIXPLAN-FIX-013-cellar-card-controls-a11y.md` — add biome-ignore comment in `cellar-card-controls.tsx`
- `docs/nightshift/plans/FIXPLAN-FIX-014-tasting-segment-a11y.md` — add biome-ignore comment in `tasting-action-segment.tsx`
- `docs/nightshift/plans/DEVPLAN-IDEA-007-availability-tier-on-catalog-cards.md` — surface availability_rarity + tier in catalog card subtitle; ~1 hour, zero AI cost

### Recommendations
- **If you have 15 min:** Run FIX-009 through FIX-012 in one pass (all tiny). Then run
  `pnpm exec biome check --write` to auto-fix the 26 import/format drift errors. Gets
  lint from 71 errors to ~2 (the two a11y biome-ignores).
- **If you have 30 min:** Also apply FIX-013 + FIX-014 (two biome-ignore comments).
  At that point `pnpm lint` should be clean.
- **If you have 1 hour:** Implement DEVPLAN-IDEA-007. Members browsing the Bourbons tab
  will immediately see "Allocated · Tier 4" on unicorn bottles. Data is already there.

---

## Run: 2026-05-31

### Summary
- Scanned: 5 post-nightshift commits — MCP server, Cloudflare OAuth proxy worker, maker pages
  (Phase 9 partial), Tonight's Pick on cellar page; all previous fixes confirmed done
- Issues: 3 new (FIX-006 unused variable, FIX-007 MCP feed under-deliver, FIX-008 moss color
  violation on maker page), 5 existing → all `done`, 0 newly resolved
- Ideas: 2 new seeds (IDEA-005 makers browse → immediately `planned`, IDEA-006 MCP member
  tastings → seed); IDEA-002 and IDEA-004 reviewed, still within 3-day stale window
- Plans written: 3 fix plans + 1 dev plan (4 total)

### Key Findings
- **MCP server shipped** — 9 tools + 5 prompts, Bearer-token auth, working. Minor behavioral bug:
  `get_club_feed` with `recommends_only=true` fetches only `limit` rows then filters, so returns
  fewer than requested when recent tastings skew non-recommend (FIX-007).
- **Cloudflare OAuth proxy** — complete Cloudflare Worker implementing RFC-compliant OAuth 2.0 +
  PKCE for Claude Desktop / MCP clients. KV-backed, ADMIN_SECRET-gated. Clean code; no issues.
- **Maker pages (Phase 9 partial)** — detail page, admin blurb edit/regen, `ensureMaker` upsert
  on first view, brand link from product detail. No browse page yet (IDEA-005).
- **Design system violation** — `text-moss-500` used for AI-derived `house_style` on maker page.
  Moss is reserved for club-validated pairing signals; house_style is an AI aggregate flavor
  description. Should be `text-foreground-subtle` (FIX-008).
- **Tonight's Pick confirmed working** — `TonightsPickSection` on cellar page renders Winston
  voice line + link to pairing detail. Zero AI cost. All previous nightshift plans executed.
- **Lint drift** — 67 Biome errors accumulated, all auto-fixable (formatter + organizeImports).
  One genuine `noUnusedVariables` error in `products/[id]/page.tsx` (FIX-006). Running
  `pnpm exec biome check --write` in the web app would clear the rest.

### Plans Ready to Execute
- `docs/nightshift/plans/FIXPLAN-FIX-006-unused-release-label-source.md` — 2-min: remove
  unused `release_label_source` from searchParams destructure
- `docs/nightshift/plans/FIXPLAN-FIX-007-club-feed-recommends-only.md` — change fetch to
  oversample when `recommends_only` is true; one-line change
- `docs/nightshift/plans/FIXPLAN-FIX-008-maker-house-style-moss-color.md` — swap `text-moss-500`
  to `text-foreground-subtle` on maker page house_style paragraph
- `docs/nightshift/plans/DEVPLAN-IDEA-005-makers-browse.md` — add `/makers` list page; 1.5–2h,
  pure DB aggregation, no AI cost, front door for Phase 9 maker investment

### Recommendations
- **If you have 15 min:** Apply FIX-006 + FIX-008 back-to-back (both trivial). Then run
  `pnpm exec biome check --write` to auto-fix formatting drift.
- **If you have 30 min:** Also apply FIX-007 (oversample in `mcpGetClubFeed`). Then test by
  calling `get_club_feed` with `recommends_only=true` from the Claude MCP client.
- **If you have 2 hours:** Build DEVPLAN-IDEA-005 (makers browse page). Zero cost, closes the
  missing front door for Phase 9.

---

## Run: 2026-05-30

### Summary
- Scanned: full codebase first run — App Router routes, server actions, lib/, supabase/migrations/, AI/OpenAI layer, cellar/taste/pairing engine, RLS policies
- Issues: 5 new (FIX-001 through FIX-005), 0 existing, 0 resolved
- Ideas: 4 new seeds (IDEA-001 through IDEA-004); IDEA-001 and IDEA-003 immediately promoted to `planned`
- Plans written: 5 fix plans + 2 dev plans (7 total)

### Key Findings
- **Identity invariant violation** in `products/[id]/page.tsx`: contributor name built as inline template string instead of `formatMemberName()`. Small but the kind of thing that bites when `formatMemberName` evolves.
- **Invite server actions missing app-layer admin check**: `createInvite` / `revokeInvite` rely solely on RLS for authorization. RLS holds, but the error UX is broken and the defense-in-depth pattern used everywhere else is absent here.
- **Storage leak on signed-URL failure in capture**: uploaded photo is orphaned if `createSignedUrl` or `identifyAndPersist` fails. Low urgency for 12 users; cleanliness + future audit concern.
- **Shell layout DB query with empty string ID**: unauthenticated requests to shell routes fire a `.eq("id", "")` query. Harmless but wasteful; adding a redirect makes the auth posture explicit.
- **Cost optimization**: `cellar/insight` and `taste/rationale` use gpt-5-mini for structured JSON extraction tasks. Both should use gpt-5-nano (5–10x cheaper) per CLAUDE.md guidance. These are the highest-frequency per-member AI calls.

### Plans Ready to Execute
- `docs/nightshift/plans/FIXPLAN-FIX-001-contributor-name.md` — 5-min fix: add formatMemberName import + use it for contributor string
- `docs/nightshift/plans/FIXPLAN-FIX-002-invite-admin-check.md` — add requireAdminSupabase helper to invites actions
- `docs/nightshift/plans/FIXPLAN-FIX-003-storage-leak.md` — add cleanup on signed-URL and identify-and-persist failures in capture
- `docs/nightshift/plans/FIXPLAN-FIX-004-layout-empty-id.md` — add null guard + redirect before DB query in shell layout
- `docs/nightshift/plans/FIXPLAN-FIX-005-nano-for-json.md` — switch cellar insight + taste rationale to MODELS.json (gpt-5-nano)
- `docs/nightshift/plans/DEVPLAN-IDEA-001-tonights-pick.md` — Tonight's Pick Winston line on cellar page; 1-2 hours, zero AI cost
- `docs/nightshift/plans/DEVPLAN-IDEA-003-maker-pages.md` — Phase 9 Maker/Distillery pages; 4-6 hours, fully specced

### Recommendations
- **If you have 30 min:** Run through FIX-001 → FIX-005 in order. All are small, self-contained changes. Start with FIX-005 (nano for JSON) — it reduces ongoing AI cost every time a member visits their cellar with changed shelf contents.
- **If you have 2 hours:** Implement IDEA-001 (Tonight's Pick on Cellar page). It's a pure server component addition, reuses existing pick-pour infrastructure, costs $0 per render, and gives Winston a home on the cellar page.
- **If you have a full evening:** Begin Phase 9 (DEVPLAN-IDEA-003-maker-pages). Start with the DB migration + aggregator unit tests + slug utility (Phases 1–3). Those are self-contained and unblock the rest.
