# NCCC Nightshift Log

Append-only. Most recent run at top.

---

## Run: 2026-06-13

### Summary
- Scanned: No new code commits since 2026-06-12 nightshift. Direct reads: pairing detail page,
  group-voice aggregation (recommend-bar, member-takes), lib/taste/rationale.ts + load.ts,
  lib/enrich/needs-enrichment.ts, you/page.tsx, members/[id]/page.tsx, you/tastings/page.tsx,
  components/members/sections/tastings-section.tsx, tasting-card.tsx. Parallel subagent: lib/taste/,
  lib/aggregation/, lib/identity/, lib/enrich/, welcome/page.tsx, members/ profile, you/ hub,
  components/primitives/, lib/mcp/ tools.
- Issues: 4 new found (FIX-035 GroupVoice member_count, FIX-036 welcome empty-user query,
  FIX-037 taste/load UPDATE error check, FIX-038 cigar enrichment logic bug). FIX-038 is
  critical — plans written and status set to `planned`. FIX-035/036/037 are low-severity,
  status `found`. 20 existing planned fixes remain open; none resolved overnight.
- Ideas: IDEA-022 parked (3-day stale). IDEA-029 promoted seed→planned + dev plan written.
  IDEA-031 seeded and immediately promoted to `planned` + dev plan written (Category 1 enhance).
  IDEA-032 seeded at Category 2 new (group chip hints on recommend form).
- Plans written: FIXPLAN-FIX-038-cigar-enrichment-logic.md, DEVPLAN-IDEA-029-retaste-shortcut.md,
  DEVPLAN-IDEA-031-pairing-score-display.md.
- Lint/build: node_modules not installed in environment; manual code scan + subagent analysis.
  No new TypeScript type errors found.

### Key Findings

- **FIX-038 (CRITICAL): Cigar catalog enrichment broken.** `needs-enrichment.ts` line 59 has
  a stray `return false` inside the `hasVisionOnlySpecs` cigar loop that fires as soon as any
  vision-only spec (vitola, country, strength, wrapper_color) has a non-empty value — which is
  virtually every photo-captured cigar. The bourbon branch (lines 45–51) has the correct logic.
  Fix is deleting one line. Impact: cigars without this fix never get Apify reviews, never get
  wheel_vector, never get trait_vector. Pairing quality for cigars is silently degraded. Plan
  written, status `planned`. **Highest-priority fix in the backlog.**

- **FIX-035: GroupVoice.member_count is tasting count, not distinct member count.** The
  RecommendBar shows "{recommendCount} of {memberCount}" using `tastings.length` as the
  denominator. With the upsert key `(user_id, product_id, release_label)`, a member who logs
  two different releases of the same product gets counted twice. The bar would show 2 icons
  instead of 1 and display "2 of 2 recommended" when 1 member tried both. Fix:
  `new Set(tastings.map(t => t.user_id)).size`. Low-severity for 12-person club.

- **IDEA-031 seeded and planned (20 min grab).** Pairing detail page never shows the computed
  score for the headline pair. Both trait vectors are already fetched; `scorePair` is one
  in-process call. `pairingTierLabel` already imported. Tier label goes in the header between
  "Winston suggests" and the cigar name. 20 minutes with no new imports needed beyond `scorePair`.

- **IDEA-029 promoted to planned (20 min grab).** Re-taste shortcut from tasting history. Add
  `showRetaste?: boolean` prop to `TastingCard` + `TastingsSection`, pass `true` from
  `/you/tastings/page.tsx`. Inner `<a>` with `e.stopPropagation()` prevents outer card Link
  from firing. Dev plan written and executable immediately.

- **IDEA-022 parked.** Admin product merge tool hit 3-day stale threshold at `planned`. Dev
  plan still fully written and ready to reclaim for a 2-hour admin session.

- **All primary lib/ areas now scanned.** lib/taste/, lib/aggregation/, lib/identity/,
  lib/enrich/, lib/pairing/engine, rationale generation, group-voice pipeline all scanned and
  generally clean beyond the issues tracked above. No Next.js 16 async-API misuse found.
  No RLS gaps beyond the already-tracked FIX-026.

### Plans Ready to Execute

- `docs/nightshift/plans/FIXPLAN-FIX-038-cigar-enrichment-logic.md` — **5 min, CRITICAL**:
  delete 1 line in needs-enrichment.ts; unblocks cigar Apify enrichment chain
- `docs/nightshift/plans/DEVPLAN-IDEA-029-retaste-shortcut.md` — **20 min**: "Try again →"
  link in tasting history; self-contained JSX change across 3 files
- `docs/nightshift/plans/DEVPLAN-IDEA-031-pairing-score-display.md` — **20 min**: pairing tier
  badge in pairing detail header; import `scorePair`, 4 lines of JSX
- `docs/nightshift/plans/DEVPLAN-IDEA-023-tasted-by-count.md` — **30 min**: "Tasted by N of
  12" in ClubVoice; `ready`, zero new DB queries
- `docs/nightshift/plans/DEVPLAN-IDEA-027-cellar-hint-dots.md` — **45 min**: cellar hint dots
  on WinstonSuggests cards
- `docs/nightshift/plans/FIXPLAN-FIX-031-pwa-manifest-icons.md` — **5 min**: fix 404 icons
- `docs/nightshift/plans/FIXPLAN-FIX-033-voice-pairing-pages.md` — **10 min**: Voice violations
  on 2 pairing pages

### Recommendations

- **If you have 15 min:** FIX-038 (5 min, CRITICAL — fixes broken cigar enrichment) + IDEA-029
  (10 min warm-up). FIX-038 is the single highest-value change in the entire backlog right now —
  one line deleted unblocks the entire cigar catalog enrichment pipeline.
- **If you have 30 min:** FIX-038 (5 min) + IDEA-029 (20 min) = first re-taste shortcut
  shipped + critical enrichment path restored.
- **If you have 1 hour:** FIX-038 + IDEA-029 + IDEA-031 (pairing score, 20 min). Three focused
  improvements: enrichment fix, UX friction fix, pairing page polish — all executable back-to-back.

---

## Run: 2026-06-12

### Summary
- Scanned: No new code commits since 2026-06-11 nightshift. Two parallel subagents: (1)
  WinstonSuggests + suggestion pipeline architecture for IDEA-027 resolution; (2) deep scan
  of previously-unscanned routes: products/depth/, you/pairings/, you/tastings/, admin/catalog/,
  pairings/[cigarId]/[bourbonId]/, lib/pairing/, you/cellar/ actions, shelf/. Manual reads:
  pairing capture/taste pages for Voice violations, search page Voice audit.
- Issues: 2 new (FIX-033 Voice on 2 additional pairing pages; FIX-034 storage leak in
  pairing taste action). 17 existing planned fixes remain open; none resolved overnight.
- Ideas: IDEA-027 promoted exploring→planned, dev plan written; IDEA-029 and IDEA-030 seeded
  (2 new ideas, one per category). No stale demotions this run (all ideas ≤ 2 days at
  current status). Note: IDEA-022 (admin product merge) reaches day 3 stale threshold
  tomorrow (2026-06-13) if no commits land.
- Plans written: DEVPLAN-IDEA-027-cellar-hint-dots.md, FIXPLAN-FIX-033-voice-pairing-pages.md,
  FIXPLAN-FIX-034-taste-action-storage-leak.md.
- Lint/build: node_modules not installed in environment; manual scan + subagent analysis.
  No new TypeScript type errors found.

### Key Findings

- **IDEA-027 architecture resolved + promoted to planned.** Nightshift subagent confirmed:
  `cellarSnapshot` is loaded inside `loadProductSuggestions` but stripped before the return
  type. All suggestion items already carry `product_id` (or `cigar_id`/`bourbon_id` for
  CrossTypePick). Cleanest fix: extend the return type to `{ suggestions, cellarSnapshot }`
  — zero new DB queries. New read-only `CellarStatusDots` component (~100 lines); thread
  snapshot through page → WinstonSuggests → per-card render. `loved` flag excluded (private
  signal). 45-minute implementation; full dev plan written.

- **FIX-033: Two more Voice violations on pairing pages.** `pairings/capture/page.tsx`
  line 40–42 and `pairings/[cigarId]/[bourbonId]/taste/page.tsx` line 64 both use
  `<Voice>` for instructional text ("One photo of the pair…") on capture/form pages —
  the same violation class as FIX-028. FIX-028 covered `capture-form.tsx` and
  `pairing-capture-flow.tsx` (the component); it missed these two page-level sites. Fix:
  replace with plain `<p className="... italic font-serif">`. 10 minutes; plan written.

- **FIX-034: Fourth storage-leak instance — pairing taste action.** `taste/actions.ts`
  uploads a photo then inserts into `product_images`. If the insert fails, no cleanup.
  Same pattern as FIX-003 (resolved), FIX-021 (planned), FIX-023 (planned). Plan written;
  matches the established `void storage.remove()` cleanup pattern exactly.

- **All previously-unscanned routes are clean.** depth/ (redirect only), you/pairings/,
  you/tastings/, admin/catalog/ (proper `requireAdminSupabase()`), pairings detail (correct
  identity use), shelf/ (redirect), lib/pairing/ — no new issues. Search page Voice usages
  are correct empty-state uses (allowed by design system).

- **19 open planned fixes total.** The execution backlog continues to grow without daytime
  code commits. IDEA-022 (admin product merge, dev plan ready) will hit the 3-day stale
  threshold tomorrow if no action.

### Plans Ready to Execute

- `docs/nightshift/plans/DEVPLAN-IDEA-027-cellar-hint-dots.md` — **45 min**: cellar hint
  dots on WinstonSuggests cards; architecture fully mapped, zero new DB queries
- `docs/nightshift/plans/FIXPLAN-FIX-033-voice-pairing-pages.md` — **10 min**: replace
  Voice with plain `<p>` on 2 pairing pages (extends FIX-028 sweep)
- `docs/nightshift/plans/FIXPLAN-FIX-034-taste-action-storage-leak.md` — **5 min**: add
  `void storage.remove()` cleanup in taste/actions.ts (4th storage-leak fix)
- `docs/nightshift/plans/FIXPLAN-FIX-031-pwa-manifest-icons.md` — **5 min**: fix 404
  icons in manifest
- `docs/nightshift/plans/FIXPLAN-FIX-032-session-release-label-length.md` — **5 min**:
  `String()` + `.slice(0, 100)` in session/actions.ts
- `docs/nightshift/plans/DEVPLAN-IDEA-023-tasted-by-count.md` — **30 min**: "Tasted by N
  of 12" in ClubVoice; `ready`, fully self-contained, zero new queries
- `docs/nightshift/plans/DEVPLAN-IDEA-022-admin-product-merge.md` — **2 hr**: admin product
  merge; highest-value unexecuted task; hits stale rule tomorrow

### Recommendations

- **If you have 15 min:** Apply FIX-031 + FIX-032 + FIX-034 — three 5-minute surgical
  cleanups closing the last manifest 404, the last release_label length gap, and the fourth
  instance of the storage-leak class.
- **If you have 30 min:** FIX-033 (10 min, closes Voice-on-capture sweep) + IDEA-023
  (30 min, ships "Tasted by N of 12" in ClubVoice). The most visible member-facing
  improvement ready to go this run.
- **If you have 2 hours:** IDEA-022 (admin product merge). Highest long-term value; also
  prevents the devplan from going stale tomorrow. Fully specced in 3 phases.

---

## Run: 2026-06-11

### Summary
- Scanned: 0 new code commits since 2026-06-10 nightshift. Targeted scan via two parallel
  subagents: (1) shelf, pairing detail pages, admin catalog/suggestions/roadmap, welcome,
  pick-pour route, pairing lib, MCP tools recommend/get_product; (2) product session form,
  pairings capture action, lib/suggestions, lib/find-next, feed page, MCP tools recommend,
  enrich-draft route, catalog-queries, PWA manifest. Manual reads: cellar/actions, catalog
  card + cellar card controls, tasting card, pairing feed card, feed query types.
- Issues: 2 new (FIX-031 PWA manifest missing icons, FIX-032 session release_label no
  length cap); 14 existing confirmed still open (FIX-018 through FIX-030).
- Ideas: 1 parked by 3-day stale rule (IDEA-021); 2 previously-seeded ideas marked `done`
  as already-implemented (IDEA-024 CellarCardControls already on CatalogCard; IDEA-025
  note already renders in TastingCard and PairingFeedCard); 1 promoted planned→ready
  (IDEA-023); 2 new ideas seeded (IDEA-027 cellar hint dots on WinstonSuggests, IDEA-028
  "new to the shelf" catalog additions).
- Plans written: 2 fix plans (FIX-031, FIX-032).
- Lint/build: node_modules not installed in environment; manual code scan + two parallel
  subagents. No new TypeScript type errors found. All confirmed fixes from prior runs still
  open — no daytime code commits since 2026-06-10 nightshift.

### Key Findings
- **IDEA-024 and IDEA-025 were already shipped — nightshift missed them on prior runs.**
  `CatalogCard` (`components/feed/catalog-card.tsx`) already renders `CellarCardControls`
  (tried/have/want/love icon row) when `cellarState != null` — passed from the feed page
  whenever a viewer is authenticated. `TastingCard` (lines 108–112) and `PairingFeedCard`
  (lines 92–96) both already render the tasting note inline. Both features have been in
  the codebase since at least 2026-06-02. These backlog entries are now marked done.
- **FIX-031: PWA manifest 404s on every page load.** `manifest.webmanifest` references
  four icon paths that don't exist. `public/icons/` only has `nccc-logo.png`. The
  `README.md` documents this as a launch-prep deferral, but the manifest should reference
  the existing file in the interim to avoid 404 noise and potential Android install
  failure. 5-minute fix: point all entries at `nccc-logo.png`.
- **FIX-032: session/actions.ts `release_label` no max-length cap.** Lines 86 and 88 use
  unsafe `as string | null` casts instead of `String()` wrapping (inconsistent with the
  rest of the file), and `releaseLabel` has no `.slice(0, 100)`. Same class as FIX-027
  (recommend page URL param). One-liner fix + type safety cleanup.
- **IDEA-023 promoted to `ready`.** The devplan (DEVPLAN-IDEA-023) is fully self-contained
  — 30 minutes, zero new queries, three touch points: type, computation, render.
- **IDEA-027 seeded + exploring.** Cellar hint dots on WinstonSuggests cards — architecture
  needs one more look at the component boundary before writing a plan.
- **16 planned fixes total.** The planned-but-unexecuted backlog continues to grow. The
  oldest unresolved (FIX-018 through FIX-023) are 5–7 days planned with no commits.

### Plans Ready to Execute
- `docs/nightshift/plans/FIXPLAN-FIX-031-pwa-manifest-icons.md` — **5 min**: replace 404
  icon paths in manifest with existing `nccc-logo.png`
- `docs/nightshift/plans/FIXPLAN-FIX-032-session-release-label-length.md` — **5 min**:
  `String()` wrapping + `.slice(0, 100)` on `releaseLabel` in session/actions.ts
- `docs/nightshift/plans/DEVPLAN-IDEA-023-tasted-by-count.md` — **30 min**: "Tasted by N
  of 12" in ClubVoice; now at `ready`, fully self-contained
- `docs/nightshift/plans/DEVPLAN-IDEA-022-admin-product-merge.md` — **2 hr**: admin product
  merge tool (highest-value unexecuted task)
- `docs/nightshift/plans/FIXPLAN-FIX-028-voice-on-capture.md` — **10 min**: replace
  Voice→p in capture-form.tsx (2 sites) and pairing-capture-flow.tsx (1 site)
- `docs/nightshift/plans/FIXPLAN-FIX-024-utc-day-name.md` — **2 min**: replace
  `getUTCDay()` in cellar Tonight's Pick
- `docs/nightshift/plans/FIXPLAN-FIX-025-utc-date-feed-today.md` — **2 min**: replace UTC
  slice in FeedList
- `docs/nightshift/plans/FIXPLAN-FIX-021-product-photo-storage-leak.md` — **5 min**: one
  cleanup line in product-photo/route.ts
- `docs/nightshift/plans/FIXPLAN-FIX-023-pairing-capture-storage-leak.md` — **5 min**: two
  cleanup lines in pairings/capture/actions.ts
- `docs/nightshift/plans/FIXPLAN-FIX-018-roadmap-admin-auth.md` — **10 min**: admin check
  in two roadmap actions
- `docs/nightshift/plans/FIXPLAN-FIX-019-moss-color-success-states.md` — **10 min**: 5
  moss→foreground swaps
- `docs/nightshift/plans/FIXPLAN-FIX-022-moss-settings-forms.md` — **10 min**: 4 more
  moss swaps
- `docs/nightshift/plans/FIXPLAN-FIX-020-dead-youmightalsolike.md` — **5 min**: delete
  dead component + barrel export

### Recommendations
- **If you have 15 min:** Apply FIX-031 (5 min manifest), FIX-032 (5 min session length),
  and FIX-020 (5 min dead component). Three surgical cleanups that close 3 tracked issues.
- **If you have 30 min:** FIX-024 + FIX-025 (4 min UTC bugs) + FIX-028 (10 min Voice
  violations) + FIX-021 + FIX-023 (10 min storage leaks) + IDEA-023 (30 min tasted-by
  count). In one session: UTC display fixed, capture Voice fixed, two storage-leak classes
  closed, tasted-by count shipped.
- **If you have 2 hours:** IDEA-022 (admin product merge). Highest long-term value: fixes
  the catalog hygiene problem before duplicates accumulate further.

---

## Run: 2026-06-10

### Summary
- Scanned: 0 new code commits since 2026-06-09 nightshift. Targeted deep-scan of under-inspected
  areas: search page, shelf page, members pages (list + profile), welcome/onboarding flow, find-
  next lib, daily-pour lib, taste lib (context/load/vector/rationale/want), onboarding lib,
  preferences lib, similarity lib, pairings capture flow, primitive components, and all member-
  profile section components.
- Issues: 2 new (FIX-029 member_saves RLS docs mismatch + loved visibility; FIX-030 duplicate
  cellar/taste DB calls in find-next); 11 existing confirmed still open (FIX-018 through FIX-028).
- Ideas: 2 parked by 3-day stale rule (IDEA-019, IDEA-020); 1 promoted seed→planned (IDEA-022);
  2 new seeds (IDEA-025 feed note preview, IDEA-026 event recap page).
- Plans written: 2 fix plans (FIX-029, FIX-030) + 1 devplan (IDEA-022) = 3 total.
- Lint/build: node_modules not installed in environment; manual code scan. No TypeScript type
  errors found in scanned files. Daily-pour `todayKey()` UTC usage is intentional per in-file
  comment (rotation stability > local time display; UI weekday fixes are FIX-024/025).

### Key Findings
- **FIX-029: `member_saves` RLS is club-wide for SELECT, not "own-only."** The migration defines
  `member_saves_select_all` — any authenticated club member can read any other member's saves,
  including the `loved` flag. STATUS.md has said "own-only" since day one. This is almost certainly
  intentional for 12 friends (the member profile Cellar tab silently depends on cross-member reads),
  but the docs are wrong. Correction committed to STATUS.md. If Paul wants `loved` truly private,
  FIX-029 plan describes the narrowed SELECT policy.
- **FIX-030: `loadFindNextSuggestions` duplicates two DB queries per call.** `loadProductSuggestions`
  called for "bourbon" and "cigar" in parallel, but each independently fetches `loadCellarSnapshot`
  and `ensureTasteRecommendations` — identical queries for the same member. Doubles connection
  overhead for these two reads (~40–80ms avoidable per find-next render). 30-min refactor: hoist
  shared loads to the outer function.
- **IDEA-022 promoted to planned.** Admin product merge tool dev plan written. 3-phase plan:
  form + auth guard → 6-step atomic merge sequence (tastings, member_saves OR-merge, images,
  pairing cache invalidation, archive secondary, invalidate Winston prose) → post-merge voice
  line. Estimated 2 hours. No new migrations needed (uses existing `archived` status).
- **`loadTasteByType` and taste module are well-structured.** Cache keyed by `signal_hash`
  (SHA-256 of tried/loved ids + preferences + SIGNAL_VERSION). Fallback to stale cache on
  rebuild failure. Cold-start path uses preference-only scoring. No issues found.
- **Members page and member profile are clean.** `formatMemberName` used correctly in both.
  Parallel queries for members list. Own-profile redirect on `/members/[id]` fires before
  loading the member data. No issues found in these pages.
- **Search page Voice context is correct.** `<Voice>` on the "no query" empty state and "no
  results" state — both are allowed empty-state contexts. "A few more letters" is borderline
  (validation hint) but defensibly a system message. Not flagging.
- **`todayKey()` UTC usage is documented and intentional.** In-file comment in `daily-pour/select.ts`
  explicitly explains the UTC tradeoff for rotation stability. FIX-024 (cellar weekday display) and
  FIX-025 (feed today variable) address the UI display layer only; the rotation seed remains UTC.
- **13 planned fixes total — backlog of quick wins continues to grow.** The oldest unresolved
  (FIX-018 through FIX-023) range from 4–6 days planned with no commits.

### Plans Ready to Execute
- `docs/nightshift/plans/DEVPLAN-IDEA-022-admin-product-merge.md` — **2 hr**: full admin product
  merge tool; re-parents tastings, OR-merges saves, archives secondary, invalidates prose cache
- `docs/nightshift/plans/FIXPLAN-FIX-029-member-saves-loved-visibility.md` — **10 min**: correct
  STATUS.md + CLAUDE.md to reflect club-wide SELECT on member_saves; optionally restrict loved
- `docs/nightshift/plans/FIXPLAN-FIX-030-find-next-duplicate-queries.md` — **30 min**: hoist
  shared cellar + taste loads in loadFindNextSuggestions to eliminate 2 duplicate DB calls
- `docs/nightshift/plans/FIXPLAN-FIX-028-voice-on-capture.md` — **10 min**: replace Voice→p in
  capture-form.tsx (2 sites) and pairing-capture-flow.tsx (1 site)
- `docs/nightshift/plans/DEVPLAN-IDEA-023-tasted-by-count.md` — **30 min**: "Tasted by N of 12"
  in ClubVoice
- `docs/nightshift/plans/FIXPLAN-FIX-024-utc-day-name.md` — **2 min**: replace `getUTCDay()`
  in cellar Tonight's Pick
- `docs/nightshift/plans/FIXPLAN-FIX-025-utc-date-feed-today.md` — **2 min**: replace UTC slice
  in FeedList
- `docs/nightshift/plans/DEVPLAN-IDEA-021-tonights-pick-empty-state.md` — **5 min**: Winston
  empty state for Tonight's Pick
- `docs/nightshift/plans/FIXPLAN-FIX-020-dead-youmightalsolike.md` — **5 min**: delete dead
  component + barrel export
- `docs/nightshift/plans/FIXPLAN-FIX-021-product-photo-storage-leak.md` — **5 min**: one cleanup
  line in product-photo/route.ts
- `docs/nightshift/plans/FIXPLAN-FIX-023-pairing-capture-storage-leak.md` — **5 min**: two
  cleanup lines in pairings/capture/actions.ts
- `docs/nightshift/plans/FIXPLAN-FIX-018-roadmap-admin-auth.md` — **10 min**: admin check in
  two roadmap actions
- `docs/nightshift/plans/FIXPLAN-FIX-019-moss-color-success-states.md` — **10 min**: 5
  moss→foreground swaps
- `docs/nightshift/plans/FIXPLAN-FIX-022-moss-settings-forms.md` — **10 min**: 4 more moss swaps

### Recommendations
- **If you have 15 min:** Apply FIX-029 (10 min doc correction) + FIX-020 (5 min dead component).
  Fast and surgical.
- **If you have 30 min:** Apply FIX-024 + FIX-025 (4 min total UTC bugs) + IDEA-021 (5 min
  Tonight's Pick empty state) + FIX-021 + FIX-023 (10 min combined storage leaks) + FIX-028
  (10 min Voice violations). In one session: UTC display bugs gone, empty state covered, two
  storage-leak classes closed, capture Voice fixed.
- **If you have 2 hours:** Implement IDEA-022 (admin product merge — the plan is ready, 2 hours).
  This is the highest-value single task: it permanently fixes the catalog hygiene problem before
  duplicates accumulate further.

---

## Run: 2026-06-09

### Summary
- Scanned: 0 new code commits since 2026-06-08 nightshift. Targeted scan via two parallel
  subagents: (1) bug hunt across enrich-draft route, MCP tools, recommend page, badge
  computation, pairing prose, and members page; (2) design system scan for Voice violations,
  brass color usage, formatMemberName compliance, "use client" overuse, type safety, and
  unhandled promise rejections.
- Issues: 3 new (FIX-026 MCP cross-member access, FIX-027 release_label length, FIX-028
  Voice on capture form); 8 existing confirmed still open (FIX-018 through FIX-025).
- Ideas: 2 parked by 3-day stale rule (IDEA-017, IDEA-018); 2 new ideas (IDEA-023 →
  immediately planned with dev plan; IDEA-024 → exploring).
- Plans written: 3 fix plans (FIX-026, FIX-027, FIX-028) + 1 devplan (IDEA-023) = 4 total.
- Lint/build: node_modules not installed; manual scan + subagent reads. No new TypeScript
  type errors found. Daily-pour card Voice flagged by Agent 2 — reviewed and confirmed
  intentional (recommendation intro context explicitly documented in the component).

### Key Findings
- **FIX-028: `<Voice />` on capture form — clear design system violation.** Two instances in
  `capture/capture-form.tsx` (lines 68 and 96) and one in `pairing-capture-flow.tsx` (~line 223)
  use the Voice component for instructional hints during photo capture. The design system says
  "Never on capture." The fix is `<p className="... italic font-serif">` — same visual personality,
  correct semantic. About 10 minutes to apply across three sites.
- **FIX-026: MCP single-token design is an undocumented cross-member data exposure.** Any bearer-
  token holder can call `get_my_cellar` or `suggest_try_next` with any member's email and get
  private shelf data. For a 12-person friends club this may be acceptable, but it's worth
  documenting. The Cloudflare OAuth proxy already provides the infrastructure for per-user token
  scoping — the plan describes both the 5-min doc fix and the full OAuth-scoped approach.
- **Daily Pour card Voice is intentional, not a violation.** Agent 2 flagged `daily-pour-card.tsx`
  line 42. On inspection the component is explicitly described as "Winston-narrated" in its header
  comment, and the Daily Pour IS a recommendation intro — an allowed Voice context. Dismissed.
- **IDEA-023 grounded and planned.** "Tasted by N of 12 members" derived client-side from the
  `loadGroupVoice` tastings array already in memory. Three touch points: `GroupVoice` type,
  `loadGroupVoice` computation, `ClubVoice` rendering. Zero extra DB query, 30 min, dev plan
  written.
- **8 planned fixes still unresolved.** The oldest (FIX-018 through FIX-021) are 5 and 4 days
  planned with no commits. The backlog of small quick-wins keeps growing.

### Plans Ready to Execute
- `docs/nightshift/plans/FIXPLAN-FIX-028-voice-on-capture.md` — **10 min**: replace Voice→p in capture-form.tsx (2 sites) and pairing-capture-flow.tsx (1 site)
- `docs/nightshift/plans/DEVPLAN-IDEA-023-tasted-by-count.md` — **30 min**: add taster_count to GroupVoice + render "Tasted by N of 12" in ClubVoice
- `docs/nightshift/plans/FIXPLAN-FIX-024-utc-day-name.md` — **2 min**: replace `getUTCDay()` in cellar page Tonight's Pick
- `docs/nightshift/plans/FIXPLAN-FIX-025-utc-date-feed-today.md` — **2 min**: replace UTC slice in feed FeedList
- `docs/nightshift/plans/DEVPLAN-IDEA-021-tonights-pick-empty-state.md` — **5 min**: Winston empty state for Tonight's Pick
- `docs/nightshift/plans/FIXPLAN-FIX-020-dead-youmightalsolike.md` — **5 min**: delete YouMightAlsoLike component + barrel export
- `docs/nightshift/plans/FIXPLAN-FIX-021-product-photo-storage-leak.md` — **5 min**: one cleanup line in product-photo/route.ts
- `docs/nightshift/plans/FIXPLAN-FIX-023-pairing-capture-storage-leak.md` — **5 min**: two cleanup lines in pairings/capture/actions.ts
- `docs/nightshift/plans/FIXPLAN-FIX-018-roadmap-admin-auth.md` — **10 min**: admin check in two roadmap actions
- `docs/nightshift/plans/FIXPLAN-FIX-019-moss-color-success-states.md` — **10 min**: 5 moss→foreground swaps
- `docs/nightshift/plans/FIXPLAN-FIX-022-moss-settings-forms.md` — **10 min**: 4 more moss swaps
- `docs/nightshift/plans/FIXPLAN-FIX-026-mcp-cross-member-access.md` — **5 min (Option A)**: add doc comment to MCP tools documenting single-token design
- `docs/nightshift/plans/DEVPLAN-IDEA-019-want-overlap-count.md` — **45 min**: "N others want this" on Want shelf
- `docs/nightshift/plans/DEVPLAN-IDEA-020-error-not-found-pages.md` — **30 min**: branded error + 404 pages with Winston voice

### Recommendations
- **If you have 15 min:** Apply FIX-028 (10 min) + FIX-020 (5 min). Capture Voice violations gone, dead component deleted. Clean, high-signal.
- **If you have 30 min:** Add FIX-024 (2 min) + FIX-025 (2 min) + IDEA-021 (5 min) + FIX-021 (5 min) + FIX-023 (5 min). In 30 min total: UTC bugs gone, Tonight's Pick has a proper empty state, two storage leak classes closed.
- **If you have 1 hour:** Add FIX-018 (10 min) + FIX-019 + FIX-022 (15 min combined) + IDEA-023 (30 min). Admin defense-in-depth complete, moss design system fully consistent, every product now shows a member quorum count in ClubVoice.

---

## Run: 2026-06-08

### Summary
- Scanned: 0 new code commits since 2026-06-07 nightshift. The "past fixes" commit (17c9b25)
  updated only nightshift plan files, not code. Targeted scan of cellar page (FIX-024 confirmed
  still open), feed page, roadmap actions (FIX-018), product-photo route (FIX-021), pairing
  capture (FIX-023), all `text-moss-*` usages, `YouMightAlsoLike` component, Winston context
  usage across all routes, and date/timezone patterns across the codebase.
- Issues: 1 new (FIX-025 UTC date in feed `today`); 7 existing confirmed still open
  (FIX-018 through FIX-024).
- Ideas: 4 parked by 3-day stale rule (IDEA-012, IDEA-014, IDEA-015, IDEA-016);
  2 new (IDEA-021 → immediately planned, IDEA-022 → seed).
- Plans written: 1 fix plan (FIX-025) + 1 devplan (IDEA-021) = 2 total.
- Lint/build: node_modules not installed in environment; manual code scan. No new TypeScript
  type errors found. All open fixes confirmed unchanged.

### Key Findings
- **FIX-025: UTC date in FeedList `today` variable.** `FeedList` uses
  `new Date().toISOString().slice(0, 10)` — UTC-based. After 8pm EDT, `today` becomes the next
  calendar day. A meetup event with `date` = today shifts from the "upcoming" query to the "last"
  query mid-evening, showing "Last meetup" while the club is still on the porch. Also kills the
  planned IDEA-014 meetup-tonight banner at 8pm EDT. One-line fix: replace with
  `new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" })` (en-CA natively
  gives YYYY-MM-DD). Same class as FIX-024 (cellar UTC weekday, still planned).
- **FIX-024 confirmed still unresolved in code.** Line 85 of `cellar/page.tsx` still has
  `days[new Date().getUTCDay()]`. The plan is complete and ready to execute (2 min).
- **FIX-020 confirmed: YouMightAlsoLike is dead.** Only exists in `you-might-also-like.tsx`
  and the barrel re-export at `product/index.ts:15`. No other imports. Safe to delete now.
- **IDEA-021 (Tonight's Pick empty state) is a 5-minute grab.** `TonightsPickSection` returns
  `null` bare when the Have shelf is empty. Adding a Winston voice + "Browse bourbons →" link
  takes one replace of a single `return null`. All imports already present in the file.
- **4 stale ideas parked.** IDEA-012 (5 days at exploring), IDEA-014 (4 days at planned),
  IDEA-015 (3 days at seed), IDEA-016 (3 days at seed). IDEA-014 and IDEA-012 have partial work
  done — fully reclaim-ready via their plan files.

### Plans Ready to Execute
- `docs/nightshift/plans/DEVPLAN-IDEA-021-tonights-pick-empty-state.md` — **5 min**: add Winston empty-state voice + catalog link to TonightsPickSection when Have shelf is empty
- `docs/nightshift/plans/FIXPLAN-FIX-024-utc-day-name.md` — **2 min**: replace `getUTCDay()` in cellar page with ET locale weekday name
- `docs/nightshift/plans/FIXPLAN-FIX-025-utc-date-feed-today.md` — **2 min**: replace UTC slice with ET locale YYYY-MM-DD in feed FeedList
- `docs/nightshift/plans/FIXPLAN-FIX-023-pairing-capture-storage-leak.md` — **5 min**: two cleanup lines in `pairings/capture/actions.ts`
- `docs/nightshift/plans/FIXPLAN-FIX-021-product-photo-storage-leak.md` — **5 min**: one cleanup line in `product-photo/route.ts`
- `docs/nightshift/plans/FIXPLAN-FIX-020-dead-youmightalsolike.md` — **5 min**: delete file + barrel export
- `docs/nightshift/plans/FIXPLAN-FIX-018-roadmap-admin-auth.md` — **10 min**: add admin check to two roadmap actions
- `docs/nightshift/plans/FIXPLAN-FIX-019-moss-color-success-states.md` — **10 min**: 5 moss→foreground swaps
- `docs/nightshift/plans/FIXPLAN-FIX-022-moss-settings-forms.md` — **10 min**: 4 more moss swaps
- `docs/nightshift/plans/DEVPLAN-IDEA-020-error-not-found-pages.md` — **30 min**: branded error + 404 pages with Winston voice
- `docs/nightshift/plans/DEVPLAN-IDEA-017-bourbon-explore-links.md` — **30 min**: bourbon research links on product detail
- `docs/nightshift/plans/DEVPLAN-IDEA-019-want-overlap-count.md` — **45 min**: "N others want this" on Want shelf

### Recommendations
- **If you have 15 min:** Apply FIX-024 (2 min) + FIX-025 (2 min) + IDEA-021 (5 min) +
  FIX-020 (5 min). Four changes, all self-contained. UTC timezone bugs gone, dead component
  gone, Tonight's Pick has a proper empty state. Bread-and-butter cleanup.
- **If you have 30 min:** Add FIX-023 (5 min) + FIX-021 (5 min) + FIX-018 (10 min) on top.
  Every storage leak class is closed, admin defense-in-depth is complete. Seven self-contained
  changes clearing the oldest planned debt.
- **If you have 1 hour:** Add FIX-019 + FIX-022 (15 min combined) to finish the moss color
  audit entirely, plus IDEA-020 (30 min branded error/404 pages). After this pass: design system
  consistent everywhere, no unbranded error screens for club members.

---

## Run: 2026-06-07

### Summary
- Scanned: 0 new code commits since 2026-06-06 nightshift. Targeted scan of cellar page,
  pairing capture, admin pages, member profiles, welcome/onboarding, session form, and the
  full app structure (confirmed no `error.tsx` / `not-found.tsx` exist anywhere).
- Issues: 1 new (FIX-024 UTC weekday mismatch in Tonight's Pick voice line); 6 existing
  confirmed still open (FIX-018 through FIX-023).
- Ideas: 4 parked by 3-day stale rule (IDEA-009, 010, 011, 013); 2 new ideas seeded and
  immediately promoted to `planned` (IDEA-019 want-overlap count, IDEA-020 error/404 pages).
- Plans written: 1 fix plan (FIX-024) + 2 devplans (IDEA-019, IDEA-020) = 3 total.
- Lint/build: node_modules not installed in environment; manual code scan. No new TypeScript
  type errors found.

### Key Findings
- **FIX-024: UTC weekday mismatch in Tonight's Pick.** `TonightsPickSection` uses
  `new Date().getUTCDay()` for Winston's day-name flavor text. After 8pm EDT (UTC-4), the UTC
  date has rolled to the next calendar day — Winston says "For a Wednesday on the porch" during
  Tuesday meetup nights. Two-line fix: replace the `days[]` array lookup with
  `new Date().toLocaleDateString("en-US", { weekday: "long", timeZone: "America/New_York" })`.
  The actual pick rotation (`todayKey()`) correctly stays in UTC and is untouched.
- **No `error.tsx` or `not-found.tsx` anywhere in the app.** When a server component throws or
  a URL is not found, Next.js renders its own default page — completely unbranded, no Winston.
  For a private iPhone PWA that shows on the patio at meetups, poor-signal errors should feel
  like the club, not a generic error screen. IDEA-020 adds both files in ~30 min.
- **IDEA-019 (Want overlap count) grounded in clear data path.** `member_saves` already contains
  all want flags. A single aggregate query (excluding the viewer's own rows) yields the counts.
  Zero AI cost, no migrations. Adds meaningful hunting-together signal for the 12-member group.
- **4 stale ideas parked.** IDEA-009 (5 days), IDEA-010 (4 days), IDEA-011 (3 days), IDEA-013
  (3 days). All four have fully written dev plans — they're parked, not lost. Reclaim any of
  them at any time by reopening the plan file. The backlog is now leaner.
- **6 planned fixes still unresolved since 2026-06-04.** The quick-wins (FIX-018: 10 min admin
  auth; FIX-019/022: moss swaps; FIX-020: dead component; FIX-021/023: storage leaks) keep
  accumulating without being committed. The oldest fix plan (FIX-018) is now 3 days old.

### Plans Ready to Execute
- `docs/nightshift/plans/FIXPLAN-FIX-024-utc-day-name.md` — **2 min**: replace `getUTCDay()` with `toLocaleDateString` in cellar page Tonight's Pick section
- `docs/nightshift/plans/FIXPLAN-FIX-023-pairing-capture-storage-leak.md` — **5 min**: two cleanup lines in `pairings/capture/actions.ts`
- `docs/nightshift/plans/FIXPLAN-FIX-021-product-photo-storage-leak.md` — **5 min**: one cleanup line in `product-photo/route.ts`
- `docs/nightshift/plans/FIXPLAN-FIX-020-dead-youmightalsolike.md` — **5 min**: delete file + barrel export
- `docs/nightshift/plans/FIXPLAN-FIX-018-roadmap-admin-auth.md` — **10 min**: add admin check to two roadmap actions
- `docs/nightshift/plans/FIXPLAN-FIX-019-moss-color-success-states.md` — **10 min**: 5 moss→foreground swaps
- `docs/nightshift/plans/FIXPLAN-FIX-022-moss-settings-forms.md` — **10 min**: 4 more moss swaps
- `docs/nightshift/plans/DEVPLAN-IDEA-020-error-not-found-pages.md` — **30 min**: branded error + 404 pages with Winston voice
- `docs/nightshift/plans/DEVPLAN-IDEA-017-bourbon-explore-links.md` — **30 min**: bourbon research links on product detail
- `docs/nightshift/plans/DEVPLAN-IDEA-014-meetup-tonight-banner.md` — **30 min**: Winston banner on meetup nights in the feed
- `docs/nightshift/plans/DEVPLAN-IDEA-019-want-overlap-count.md` — **45 min**: "N others want this" on Want shelf

### Recommendations
- **If you have 30 min:** Apply FIX-024 (2 min) + FIX-023 (5 min) + FIX-021 (5 min) +
  FIX-020 (5 min) + FIX-018 (10 min). Five changes, all self-contained, clears the oldest
  debt. The storage leaks, dead component, and admin auth gap are all gone in a single pass.
- **If you have 1 hour:** Add FIX-019 + FIX-022 (15 min combined, moss cleanup done) and
  IDEA-020 (30 min, branded error + 404 pages). After this pass: lint clean, design system
  consistent, and the app no longer shows raw Next.js error pages to club members.
- **If you have 2 hours:** Implement IDEA-017 (bourbon explore links, 30 min) + IDEA-014
  (meetup tonight banner, 30 min) + IDEA-019 (want overlap count, 45 min). Members can now
  click to Whiskybase from bourbon detail, see tonight's meetup called out in the feed, AND
  see who else in the club is hunting the same bottles.

---

## Run: 2026-06-06

### Summary
- Scanned: 0 new code commits since 2026-06-05 nightshift. Full codebase rescan focused on
  pairing capture actions, cellar page, MCP route, maker load, product detail explore links,
  tasting action segment, onboarding flow, and all outstanding tracked issues.
- Issues: 1 new (FIX-023 storage leak in pairing capture); 5 existing confirmed still open
  (FIX-018, FIX-019, FIX-020, FIX-021, FIX-022)
- Ideas: 2 new (IDEA-017 bourbon explore links → immediately `planned`; IDEA-018 native share
  sheet → `seed`); no stale promotions this run (all existing seeds <2 days old)
- Plans written: 1 fix plan (FIX-023) + 1 devplan (IDEA-017) = 2 total
- Lint/build: node_modules not installed; manual code scan. No new TypeScript type errors found.

### Key Findings
- **FIX-023: Storage leak in `pairings/capture/actions.ts`** — `identifyPairingPhoto` uploads
  a photo then calls `createSignedUrl` and `identifyPairFromImage`. On either failure the
  uploaded file is abandoned in storage without cleanup. This is the identical pattern as
  FIX-003 (single capture, resolved in 2026-05-30) and FIX-021 (product-photo admin route,
  planned). Two-line fix: add `void supabase.storage.from(BUCKET).remove([storagePath])` before
  each error return that happens after the upload succeeds. Plan written and ready.
- **All 5 previous planned fixes confirmed still unresolved** — no code commits since the
  2026-06-05 nightshift ran. The backlog of quick wins continues to accumulate.
- **IDEA-011 (Reach for Next subtitle) confirmed not yet implemented** — `winston-suggests.tsx`
  Reach for Next card section (lines ~136–154) still does not render `p.subtitle`. The Similar
  in Tier section (lines ~162–190) already does. Dev plan exists, estimate 10 min.
- **IDEA-017 seeded and planned** — `ExploreLinks` is already type-guarded to cigars only in
  product detail. Bourbon product detail has no equivalent research section. Two bourbon links
  (Whiskybase, Distiller.com) and a `productType` prop close the gap. Dev plan written.
- **FIX-019/022 moss violations fully mapped** — Rescanned all `text-moss-*` usages.
  `find-your-next-hero.tsx` (line 260) uses moss correctly (guarded by `item.club_validated`).
  `admin/suggestions/suggestion-row.tsx` and `admin/invites/page.tsx` are admin-internal.
  The 9 violations tracked in FIX-019 + FIX-022 are the complete set needing fixes.

### Plans Ready to Execute
- `docs/nightshift/plans/FIXPLAN-FIX-023-pairing-capture-storage-leak.md` — **5 min**: two cleanup lines in `pairings/capture/actions.ts` (identical pattern to resolved FIX-003)
- `docs/nightshift/plans/DEVPLAN-IDEA-017-bourbon-explore-links.md` — **30 min**: add bourbon Whiskybase + Distiller links; `productType` prop on `ExploreLinks`
- `docs/nightshift/plans/DEVPLAN-IDEA-011-reach-for-next-subtitle.md` — **10 min**: add `p.subtitle` to Reach for Next cards in `winston-suggests.tsx`
- `docs/nightshift/plans/FIXPLAN-FIX-020-dead-youmightalsolike.md` — **5 min**: delete `you-might-also-like.tsx` and barrel export (pair with IDEA-011)
- `docs/nightshift/plans/FIXPLAN-FIX-021-product-photo-storage-leak.md` — **5 min**: one-line cleanup in `product-photo/route.ts`
- `docs/nightshift/plans/FIXPLAN-FIX-018-roadmap-admin-auth.md` — **10 min**: add admin check to two roadmap actions
- `docs/nightshift/plans/FIXPLAN-FIX-019-moss-color-success-states.md` — **10 min**: 5 moss→foreground swaps
- `docs/nightshift/plans/FIXPLAN-FIX-022-moss-settings-forms.md` — **10 min**: 4 more moss swaps
- `docs/nightshift/plans/DEVPLAN-IDEA-014-meetup-tonight-banner.md` — **30 min**: Winston meetup night banner on feed
- `docs/nightshift/plans/DEVPLAN-IDEA-013-catalog-rec-count-badge.md` — **45 min**: rec count badge on catalog cards
- `docs/nightshift/plans/DEVPLAN-IDEA-010-availability-filter-chip.md` — **1–1.5 hr**: availability filter chip in Bourbons browse

### Recommendations
- **If you have 30 min:** Apply FIX-023 (5 min) + IDEA-011 (10 min) + FIX-020 (5 min) + FIX-018
  (10 min). Four self-contained changes: closes the last storage-leak class, adds subtitles to
  Reach for Next cards, deletes the dead component, and adds admin defense-in-depth to roadmap.
- **If you have 1 hour:** Add IDEA-017 (30 min) on top — bourbon explore links give members
  direct research paths for bourbons they discover in the catalog. Plus FIX-019 + FIX-022 (15 min
  combined) to finish the moss color cleanup and get the design system fully consistent.
- **If you have 2 hours:** Implement DEVPLAN-IDEA-014 (meetup tonight banner, 30 min) + DEVPLAN-
  IDEA-013 (rec count badge, 45 min) + DEVPLAN-IDEA-010 (availability filter chip, 1–1.5 hr).
  Members see club social proof in the catalog AND can filter to "Allocated" in one tap.

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
