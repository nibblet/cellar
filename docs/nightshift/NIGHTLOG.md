# NCCC Nightshift Log

Append-only. Most recent run at top.

---

## Run: 2026-06-05

### Summary
- Scanned: 0 code commits since last run (last code commit was `b1ac846` — captured by 2026-06-04 nightshift). Full codebase rescan focused on product-photo route, settings forms, roadmap actions, club voice, meetup card, catalog queries, and cellar page.
- Issues: 2 new (FIX-021 storage leak in product-photo route, FIX-022 additional moss violations in settings forms); 3 existing open confirmed still present (FIX-018, FIX-019, FIX-020)
- Ideas: 2 new seeds (IDEA-015 tasting digest export, IDEA-016 my notes first in ClubVoice); IDEA-014 promoted seed → planned; IDEA-012 promoted seed → exploring
- Plans written: 2 fix plans + 1 devplan (3 total)
- Lint/build: node_modules not installed; manual code scan. No new TypeScript type errors found.

### Key Findings
- **FIX-021: Storage leak in `product-photo/route.ts`** — The admin member-photo POST path uploads to `product-photos`, then inserts into `product_images`. If the DB insert fails, the uploaded file is abandoned in storage. One-line fix: add `void admin.storage.from(PHOTOS_BUCKET).remove([storagePath])` before the 500 return. Same class as FIX-003 (capture action, resolved). Small risk for 12 users but clean.
- **FIX-022: 4 more moss violations in settings forms** — `avatar-uploader.tsx`, `display-name-form.tsx`, `preferences-form.tsx`, and `suggestion-form.tsx` all use `text-moss-600` as a generic success color. Distinct from FIX-019 (which covers the 5 more impactful sites). All four swap to `text-foreground-muted`.
- **IDEA-014 ready to implement** — Scanned `page.tsx` and `meetup-card.tsx`. The feed already fetches `upcoming` events; deriving `isTonightMeetup = upcoming?.date === today` costs zero extra queries. A new `MeetupTonightBanner` component + a JSX conditional is all that's needed. 30-minute job. Plan written.
- **IDEA-012 promoted to exploring** — Verified that `lib/cellar/` has no usage of `availability_rarity`. The data path is clear: `loadCellarProducts` returns Want items, fetch `specs` join, filter where `availability_rarity IN (allocated, lottery, secondary-only)`. Clean two-step implementation.
- **IDEA-016 seeded** — Noticed `ClubVoice` renders `myTake` (Your notes) AFTER `otherTakes` (other members). For products with many member takes, the current member scrolls past everyone else before seeing their own notes. JSX reorder: `<YourNotes>` before `<MemberTakes>`. 5-minute change — flagged for Paul's preference call.
- **All 3 previously planned fixes (FIX-018, 019, 020) confirmed still unresolved** — no code commits since 2026-06-04 nightshift ran.

### Plans Ready to Execute
- `docs/nightshift/plans/DEVPLAN-IDEA-011-reach-for-next-subtitle.md` — **10 min**: add `p.subtitle` to Reach for Next cards in `winston-suggests.tsx`
- `docs/nightshift/plans/FIXPLAN-FIX-020-dead-youmightalsolike.md` — **5 min**: delete `you-might-also-like.tsx` + remove barrel export (pair with IDEA-011)
- `docs/nightshift/plans/FIXPLAN-FIX-021-product-photo-storage-leak.md` — **5 min**: one-line cleanup before 500 return in `product-photo/route.ts`
- `docs/nightshift/plans/FIXPLAN-FIX-018-roadmap-admin-auth.md` — **10 min**: add `requireAdminSupabase()` to two roadmap actions
- `docs/nightshift/plans/FIXPLAN-FIX-019-moss-color-success-states.md` — **10 min**: 5 moss→foreground swaps across product/admin files
- `docs/nightshift/plans/FIXPLAN-FIX-022-moss-settings-forms.md` — **10 min**: 4 more moss→foreground swaps in settings forms
- `docs/nightshift/plans/DEVPLAN-IDEA-014-meetup-tonight-banner.md` — **30 min**: Winston tonight banner on feed meetup day
- `docs/nightshift/plans/DEVPLAN-IDEA-013-catalog-rec-count-badge.md` — **45 min**: expose rec_count and render on catalog cards
- `docs/nightshift/plans/DEVPLAN-IDEA-010-availability-filter-chip.md` — **1–1.5 hr**: availability filter chip in Bourbons browse

### Recommendations
- **If you have 15 min:** IDEA-011 (10 min) + FIX-020 (5 min) — pair them; they touch the same component area. Subtitles appear in Reach for Next cards and the dead component is gone.
- **If you have 30 min:** Add FIX-021 (5 min) + FIX-018 (10 min) on top. Four changes, all self-contained.
- **If you have 1 hour:** Implement IDEA-014 (meetup tonight banner, 30 min) — the next meetup night it's live it will feel magical. Then FIX-019 + FIX-022 together (moss cleanup, ~15 min combined). Design system fully consistent.
- **If you have 2 hours:** IDEA-013 (rec count badge, 45 min) + IDEA-010 (availability filter chip, 1–1.5 hr). Members browsing Bourbons see club social proof AND can filter by allocation tier.

---

## Run: 2026-06-04

### Summary
- Scanned: 1 code commit since last run — `b1ac846` ("fixes and landing subtitle line updates"), applied FIX-015, FIX-016, FIX-017
- Issues: 3 new (FIX-018 admin auth in roadmap, FIX-019 moss color violations, FIX-020 dead component); FIX-015 + FIX-016 + FIX-017 marked done
- Ideas: 2 new (IDEA-013 rec count badge → `planned`; IDEA-014 meetup day banner → `seed`); IDEA-008 parked (3-day stale rule); IDEA-011 promoted `planned` → `ready` (FIX-017 dependency landed)
- Plans written: 3 fix plans + 1 devplan (4 total)
- Lint/build: node_modules not installed; manual code scan. No new TypeScript type errors found after FIX-017 landed.

### Key Findings
- **FIX-015, FIX-016, FIX-017 all resolved** in commit `b1ac846`. Group-validation identity invariant fixed, scene generator now validates CLI flags, ReachForNextPick subtitle unblocked. The build should now be clean.
- **IDEA-011 is unblocked and ready** — the only remaining work is adding `{p.subtitle && ...}` to the "Reach for next" card JSX in `winston-suggests.tsx` (mirror of what's already done for "Similar in tier" cards). 10-minute change.
- **FIX-018 (admin auth in roadmap actions)** — `updateSuggestionStatus` and `deleteSuggestion` in `roadmap/actions.ts` have no app-layer auth check. RLS does protect the DB, but non-admins get a raw Postgres error instead of "Not authorized." Same class as FIX-002. Medium severity.
- **FIX-019 (moss color violations)** — five places use `text-moss-500` for generic success/feedback states. Most impactful is "Club staple" on product detail (member-visible), which shares visual language with moss-colored pairing validation — implying club endorsement it doesn't represent. Four-word fix per site.
- **FIX-020 (dead YouMightAlsoLike)** — `YouMightAlsoLike` component is exported from the barrel but zero callers remain. Superseded by `WinstonSuggests`. Safe to delete.
- **IDEA-013 seeded and planned** — `loadCatalogBrowse` already computes `rec_count` per product for sorting but strips it before returning `CatalogEntry`. Expose it, render "N club recs" on cards with 2+ recs. 45 minutes, zero AI cost, zero migrations.
- **IDEA-008 parked** — 3-day stale rule triggered (seeded 2026-06-01). IDEA-012 (Personal Hunt List) covers the hunting-awareness angle more holistically.

### Plans Ready to Execute
- `docs/nightshift/plans/DEVPLAN-IDEA-011-reach-for-next-subtitle.md` — **10 min**: add `p.subtitle` rendering to "Reach for next" horizontal scroll cards in `winston-suggests.tsx`
- `docs/nightshift/plans/FIXPLAN-FIX-020-dead-youmightalsolike.md` — **5 min**: delete `you-might-also-like.tsx` and remove barrel export (pair with IDEA-011)
- `docs/nightshift/plans/FIXPLAN-FIX-018-roadmap-admin-auth.md` — **10 min**: add `requireAdminSupabase()` to two functions in `roadmap/actions.ts`
- `docs/nightshift/plans/FIXPLAN-FIX-019-moss-color-success-states.md` — **10 min**: swap `text-moss-500` → `text-foreground-muted` in 5 files
- `docs/nightshift/plans/DEVPLAN-IDEA-013-catalog-rec-count-badge.md` — **45 min**: expose `rec_count` in `CatalogEntry` + render "N club recs" badge on cards
- `docs/nightshift/plans/DEVPLAN-IDEA-010-availability-filter-chip.md` — **1–1.5 hr**: availability filter chip in Bourbons browse (carried from last night, still unblocked)

### Recommendations
- **If you have 15 min:** Apply IDEA-011 (10 min) + FIX-020 (5 min) back-to-back — they touch adjacent lines in the same component area. The "Reach for next" cards will then show subtitles, and the dead component will be gone.
- **If you have 30 min:** Also apply FIX-018 (admin auth, 10 min) + FIX-019 (moss color, 10 min). All four are safe, self-contained, and sequential.
- **If you have 2 hours:** Implement DEVPLAN-IDEA-013 (rec count badge, 45 min) + DEVPLAN-IDEA-010 (availability filter chip, 1–1.5 hr). Members browsing the Bourbons tab will be able to both see "3 club recs" on popular bottles and filter to "Allocated" in one tap.

---

## Run: 2026-06-03

### Summary
- Scanned: 2 commits since last run — FIX-009–014 lint cleanup (`2105dd6`), and
  availability/tier subtitle + bourbon-shelf CSV revision + scene source review
  (`3b1acfb`, "updates to tagline of bourbons")
- Issues: 1 new (FIX-017 — TypeScript build failure from missing subtitle field),
  2 existing still planned (FIX-015, FIX-016)
- Ideas: 2 new (IDEA-011 subtitle consistency → immediately planned; IDEA-012 Personal
  Hunt List → seed); IDEA-006 parked (3-day stale rule); IDEA-007 marked done;
  IDEA-010 promoted from seed → planned (unblocked by IDEA-007 landing)
- Plans written: 1 fix plan + 2 devplans (3 total)
- Lint/build: node_modules not installed; manual code scan. FIX-017 is a confirmed
  TypeScript type error (missing required property) that would fail `pnpm build`.

### Key Findings
- **FIX-017: TypeScript build will fail.** Commit `3b1acfb` added `subtitle: string | null`
  as a required field to `AdjacentProduct` and updated `suggestAdjacentProducts` to compute
  it. However, `loadReachForNext` in `lib/suggestions/load-product-suggestions.ts` (line
  108–117) also constructs `ReachForNextPick` (which extends `AdjacentProduct`) manually
  for the shelf-first path — and that object literal was not updated with the new field.
  TypeScript strict will reject the missing required property. Fix: import
  `composeProductSubtitle` and add `subtitle: composeProductSubtitle(source.type, row.specs ?? {})`
  to the returned object. One-line fix.
- **IDEA-007 is shipped.** `composeProductSubtitle` now emits "Allocated", "Seasonal",
  "Lottery", "Tier N" tokens for bourbons. "Everyday" is correctly suppressed (no noise).
  5 unit tests added. `suggestAdjacentProducts` also passes `subtitle` through, and the
  "Similar in tier" cards in `WinstonSuggests` render it.
- **bourbon-shelf.csv comprehensively updated.** Tier and availability values were revised
  across the full catalog — e.g. 1792 Full Proof moved from tier 1/everyday to tier
  3/allocated, 1792 Small Batch moved from tier 3/allocated to tier 1/everyday. These
  now flow through to the UI via the updated subtitle and the seed script. Running
  `pnpm gen:seed-catalog` will push the revised data to Supabase.
- **IDEA-010 unblocked.** Now that availability is visible in the subtitle (IDEA-007 done),
  the availability filter chip is the natural next step. Promoted to planned, devplan written.
- **Dead component spotted.** `YouMightAlsoLike` in `components/product/you-might-also-like.tsx`
  is exported from the barrel but never imported anywhere. It was superseded by
  `WinstonSuggests`. Candidate for deletion (noted in DEVPLAN-IDEA-011).
- **FIX-015 and FIX-016 still open.** No commits touching `group-validation.ts` or the
  scene generator. Plans remain ready to execute.
- **IDEA-006 parked.** Hit 3-day stale rule (seeded 2026-05-31). MCP `get_my_cellar` is
  a reasonable approximation for the 12-member group.

### Plans Ready to Execute
- `docs/nightshift/plans/FIXPLAN-FIX-017-subtitle-missing-reach-for-next.md` — **do this first**: add `subtitle` to shelf-scored `ReachForNextPick`; unblocks build
- `docs/nightshift/plans/FIXPLAN-FIX-015-group-validation-identity.md` — 3-line fix: import + two template-string replacements in group-validation.ts
- `docs/nightshift/plans/FIXPLAN-FIX-016-scene-generator-size-cast.md` — add allowlist for --size/--quality in scene generator
- `docs/nightshift/plans/DEVPLAN-IDEA-011-reach-for-next-subtitle.md` — 10 min: add subtitle to "Reach for next" cards (after FIX-017)
- `docs/nightshift/plans/DEVPLAN-IDEA-010-availability-filter-chip.md` — 1–1.5 hr: availability filter chip in Bourbons browse

### Recommendations
- **If you have 10 min:** Apply FIX-017 (one-line fix to unblock the build). Then FIX-015
  (three lines in group-validation.ts). Then FIX-016 (allowlist validation in scene generator).
  All three are small, safe, and sequential.
- **If you have 30 min:** Apply FIX-017 + FIX-015 + FIX-016, then immediately add IDEA-011
  (10-min subtitle consistency in "Reach for next" cards). Closes out all outstanding fixes
  and gets visual consistency across the WinstonSuggests scroll sections.
- **If you have 2 hours:** Implement DEVPLAN-IDEA-010 (availability filter chip). Members
  browsing Bourbons can filter to "Allocated" or "Lottery" in one tap. High payoff, zero AI
  cost, fully specced.
- **Action needed:** Run `pnpm gen:seed-catalog` (or `supabase db push` after confirming
  the revised CSV tiers/availability are correct) to push the bourbon-shelf.csv revisions
  to the live Supabase instance. The CSV changed significantly — 1792 Full Proof is now
  tier 3/allocated, 1792 Small Batch is tier 1/everyday, and others shifted.

---

## Run: 2026-06-02

### Summary
- Scanned: 1 commit since last nightshift — catalog scene-generator script
  (`scripts/media/generate-catalog-scenes.ts`) for gpt-image-1 glamour shots
- Issues: 2 new (FIX-015 identity invariant in group-validation.ts, FIX-016 scene
  generator --size cast), 6 existing still planned (FIX-009 through FIX-014, none resolved)
- Ideas: 2 new (IDEA-009 scene upload workflow → immediately planned, IDEA-010 availability
  filter chip → seed); IDEA-006 approaching 3-day stale (triggers tomorrow); all others reviewed
- Plans written: 2 fix plans + 1 devplan (3 total)
- Lint/build: could not run (node_modules not installed in environment). Manual scan performed.

### Key Findings
- **Identity invariant re-occurs** — `lib/pairing/group-validation.ts` lines 76 and 137 build
  `display_name` via raw template string instead of `formatMemberName()`. This is the same
  pattern as the FIX-001 fix applied to `products/[id]/page.tsx` in May. Impact: club-validated
  pairing attribution will be wrong for the two-Paul disambiguation path when it eventually
  applies. Quick two-line fix.
- **Scene generator --size cast silences TypeScript** — `size as "1024x1024"` at line 129
  allows any string to reach the OpenAI API without validation. The valid gpt-image-1 edit
  sizes are `1024x1024`, `1536x1024`, `1024x1536`, `auto`. An allowlist check gives early,
  clear errors instead of a confusing API rejection.
- **Scene generator workflow gap** — the script generates to `out/` but has no upload step.
  IDEA-009 (planned) adds `--upload` / `--dry-run-upload` flags using the same `adminClient()`
  + `getPublicUrl` pattern already used by `api/product-photo/route.ts`. Closes the batch
  workflow without any new UI.
- **DEVPLAN-IDEA-006-pair-me-ux.md discrepancy documented** — that plan file describes the
  shipped WinstonSuggests / Pair-Me UX feature (committed before this nightshift system
  existed). BACKLOG.md IDEA-006 correctly refers to the MCP member tastings tool. STATUS.md
  updated with a discrepancy note.
- **IDEA-007 still not implemented** — `composeProductSubtitle` still omits
  `availability_rarity` and `tier`. Data is there; the plan exists. Prioritize this next
  session. Note: `FactsStrip` on product detail already shows `availabilityLabel`; only the
  catalog browse card subtitle is missing it.
- **IDEA-006 approaching stale** — seeded 2026-05-31, now 2 days old. Will trigger 3-day
  stale rule tomorrow (2026-06-03) if no action. Paul should either promote or park it.

### Plans Ready to Execute
- `docs/nightshift/plans/FIXPLAN-FIX-015-group-validation-identity.md` — 3-line fix: import `formatMemberName`, replace two template strings in group-validation.ts
- `docs/nightshift/plans/FIXPLAN-FIX-016-scene-generator-size-cast.md` — add allowlist validation for --quality and --size in the scene generator script
- `docs/nightshift/plans/DEVPLAN-IDEA-009-scene-upload-workflow.md` — add --upload / --dry-run-upload flags to generate-catalog-scenes.ts; ~1 hour
- `docs/nightshift/plans/DEVPLAN-IDEA-007-availability-tier-on-catalog-cards.md` — (from last night, still unimplemented) surface availability/tier in catalog browse subtitle; ~1 hour

### Recommendations
- **If you have 10 min:** Apply FIX-015 (3-line change in group-validation.ts + import). Then FIX-016 (allowlist validation in scene generator). Both are safe, self-contained, and close long-standing debt.
- **If you have 30 min:** Apply all of FIX-009 through FIX-016 in one pass (most are 1–3 lines each). Gets lint clean and identity invariants solid across the codebase.
- **If you have 1 hour:** Implement DEVPLAN-IDEA-007 (availability/tier in catalog subtitle). Members browsing Bourbons immediately see "Allocated" or "Everyday" without tapping through to product detail. High payoff, zero cost, no migrations.
- **Decision needed:** IDEA-006 (MCP member tastings) will hit its 3-day stale rule tomorrow. Either promote to `planned` (1-hour implementation) or park it.

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
