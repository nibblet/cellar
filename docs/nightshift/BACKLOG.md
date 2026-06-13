# NCCC — Ideas Backlog

Maturity: seed → exploring → planned → ready → parked

---

## Category 1 — Enhance Existing

### [IDEA-001] Cellar-aware "Tonight's Pick" Winston line on Cellar page header
- **Status:** done
- **Category:** enhance
- **Seeded:** 2026-05-30
- **Last Updated:** 2026-05-30
- **Done:** 2026-05-30
- **Priority:** P2
- **Plan:** `docs/nightshift/plans/DEVPLAN-IDEA-001-tonights-pick.md`
- **Summary:** Surface a Winston one-liner above the cellar page that nominates a specific pairing from the member's Have shelf for tonight — e.g. "For a Thursday in May: that Oliva Serie V with the Weller 12." Built on existing `selectPickPour` + `selectDailyPour` logic; no new AI call needed (deterministic pick, short prose template).
- **Night Notes:**
  - 2026-05-30: Seeded. `selectPickPour` + `loadPickPourCandidates` already exist and are well-tested. The Cellar page has a Suspense section (`TryNextSection`); a `TonightsPick` section would slot in just above it. Promote to `planned` immediately — small scope, reuses existing infrastructure.

---

### [IDEA-002] Badge milestone notification on the You hub
- **Status:** parked
- **Category:** enhance
- **Seeded:** 2026-05-30
- **Last Updated:** 2026-06-01
- **Priority:** P3
- **Plan:** (not yet written)
- **Summary:** When a member reaches a new badge milestone, show a Winston congratulation block at the top of the You hub (one-time dismissible via `localStorage`). The badge system already computes `nextBadge`; this closes the feedback loop so members notice when they level up.
- **Night Notes:**
  - 2026-05-30: Seeded. Needs a mechanism to detect "just earned" — probably a `last_seen_badge_level` column in `users` or a client-side localStorage check. Mild complexity; park until cellar / maker work lands.
  - 2026-05-31: Reviewed. Maker pages and MCP work landed today. Still no commits touching badges. P3 remains appropriate — not yet stale (2 days old).
  - 2026-06-01: 3-day stale rule triggered (seeded 2026-05-30, no commits). Demoting to `parked`. Cellar + catalog CSV work dominated; badge milestone remains low-priority relative to surfacing new catalog metadata.

---

### [IDEA-005] Makers browse page — `/makers` list
- **Status:** done
- **Category:** enhance
- **Seeded:** 2026-05-31
- **Last Updated:** 2026-05-31
- **Priority:** P2
- **Plan:** `docs/nightshift/plans/DEVPLAN-IDEA-005-makers-browse.md`
- **Summary:** A `/makers` list page grouped by type (cigar makers / distilleries) showing all brands in the catalog with product counts and house style. Currently maker pages are only reachable by tapping a brand on product detail — there's no front door. Completes the Phase 9 investment.
- **Night Notes:**
  - 2026-05-31: Seeded and immediately promoted to `planned`. Phase 9 detail pages exist but browsing to them requires knowing which product to tap first. This is pure DB aggregation — no AI cost, 1.5–2 hours of work, high discoverability payoff.
  - 2026-05-31: Shipped — `/makers` index, in-tab `view=makers` on Cigars/Bourbons, filter-sheet links, clickable bourbon brand-family dividers.

---

## Category 1 — Enhance Existing (continued — IDEA-009 added 2026-06-02, see end of Cat 1 above)

---

## Category 2 — New Feature or Integration

### [IDEA-003] Phase 9 — Maker & Distillery pages
- **Status:** done (Part A); Part B refinements planned
- **Category:** new
- **Seeded:** 2026-05-30
- **Last Updated:** 2026-06-02
- **Done:** 2026-05-30 (Part A)
- **Priority:** P2 (Part B)
- **Plan:** `docs/nightshift/plans/DEVPLAN-IDEA-003-maker-pages.md` · Part B: `docs/nightshift/plans/DEVPLAN-IDEA-003-maker-pages-part-b.md`
- **Summary:** Tappable maker/distillery pages keyed by brand name. Each page shows a Winston blurb (AI-generated, admin-editable), country/region, the club's catalog from that house, and a one-line house-style read derived from aggregated `trait_vector` across the maker's products. Turns dead brand text on product detail into an explorable surface. Fully specced in `planning/nccc-implementation-plan.md` Phase 9.
- **Night Notes:**
  - 2026-05-30: Seeded + immediately promoted to `planned`. `catalog_hierarchy` migration already landed (20260527000001). Bourbon catalog is well-seeded. Phase 9 plan from spec is detailed; dev plan can lift directly from it. P1 because it's the next major feature in the roadmap.
  - 2026-06-02: Part A review — core routes shipped; gaps: `country`/`website` never written, `house_style` stale after first visit, Part A manual QA open. Part B dev plan written.

---

### [IDEA-004] Personal stats mini-dashboard on You hub
- **Status:** parked
- **Category:** new
- **Seeded:** 2026-05-30
- **Last Updated:** 2026-06-01
- **Priority:** P3
- **Plan:** (not yet written)
- **Summary:** A small "By the numbers" card on the You hub showing: total tastings, total pairings, favorite wrapper, favorite bourbon style, strongest vs. mildest cigars tried — derived from `tastings` + `member_saves` data already in DB. Phase 8.4 in the plan, not yet implemented.
- **Night Notes:**
  - 2026-05-30: Seeded. Mentioned in nccc-implementation-plan.md as Phase 8.4. Pure DB aggregation — no AI cost. Lower priority than maker pages; park unless P&L asks for it.
  - 2026-05-31: Reviewed. Still 1 day old. No commits. Holding at seed.
  - 2026-06-01: 3-day stale rule triggered (seeded 2026-05-30, no commits). Demoting to `parked`. Not yet asked for by Paul.

---

### [IDEA-006] MCP `get_member_tastings` tool
- **Status:** parked
- **Category:** new
- **Seeded:** 2026-05-31
- **Last Updated:** 2026-06-03
- **Priority:** P3
- **Plan:** (not yet written)
- **Summary:** Add a `get_member_tastings` tool to the MCP server so members can ask Claude "what have I tried?" and get a paginated history of their tastings with product names, recommend flags, chips, and notes. Currently `get_my_cellar` shows shelf state (have/want/tried/loved counts) and `get_club_feed` shows recent club activity, but there's no way to query one member's full personal history.
- **Note:** `docs/nightshift/plans/DEVPLAN-IDEA-006-pair-me-ux.md` exists from a pre-nightshift session — it documents the shipped Pair-Me UX / WinstonSuggests feature, not this tool. That plan file is orphaned shipped-work documentation; it does not belong to this backlog entry.
- **Night Notes:**
  - 2026-05-31: Seeded. The MCP server now has 9 tools; this would be the 10th. `loadFeed` already accepts a `userId` filter. Low effort — maybe 1 hour — but lower priority than makers browse since the cellar shelf gives a reasonable approximation.
  - 2026-06-01: Reviewed. 1 day old. No commits. Holding at seed — not yet stale.
  - 2026-06-02: 2 days old. No commits. Approaching 3-day stale threshold (triggers tomorrow 2026-06-03 if no action). Holding at seed tonight.
  - 2026-06-03: 3-day stale rule triggered. No commits. Demoting to `parked`. The MCP cellar tool provides reasonable approximation; this is a nice-to-have for a private 12-person app.

---

### [IDEA-007] Surface availability_rarity + cobbTier on catalog cards and product detail
- **Status:** done
- **Category:** enhance
- **Seeded:** 2026-06-01
- **Last Updated:** 2026-06-03
- **Done:** 2026-06-02 (commit `3b1acfb`)
- **Priority:** P2
- **Plan:** `docs/nightshift/plans/DEVPLAN-IDEA-007-availability-tier-on-catalog-cards.md`
- **Summary:** The bourbon CSV seed now populates `specs.availability_rarity` (allocated/lottery/seasonal/…) and `specs.tier` (1–5). These exist in the DB but are invisible in the UI — neither the catalog card subtitle nor the product detail header show them. Extending `composeProductSubtitle` to emit "Allocated" / "Tier N" tokens makes the catalog self-documenting for members browsing or hunting. Note: `FactsStrip` on product detail already shows `availabilityLabel`; the gap is the browse-card subtitle only.
- **Night Notes:**
  - 2026-06-01: Seeded and immediately promoted to `planned`. Zero AI cost, zero DB changes, zero migrations. Data is already there; it just needs to flow through `composeProductSubtitle`. ~1 hour of work. High signal: members will finally be able to see which bottles are Allocated without opening each product detail.
  - 2026-06-02: Reviewed. Not yet implemented (no commits touching composeProductSubtitle). Holding at planned. Still 1 day old; no stale risk.
  - 2026-06-03: Shipped in commit `3b1acfb`. `composeProductSubtitle` now calls `normalizeAvailabilityRarity` + `normalizeCobbTier`; "everyday" is omitted (no noise), non-everyday rarity and tier are emitted. 5 unit tests added. `suggestAdjacentProducts` also updated to pass `subtitle` through to `AdjacentProduct`.

---

### [IDEA-010] Availability filter chip in bourbon catalog browse
- **Status:** parked
- **Category:** new
- **Seeded:** 2026-06-02
- **Last Updated:** 2026-06-07
- **Priority:** P2
- **Plan:** `docs/nightshift/plans/DEVPLAN-IDEA-010-availability-filter-chip.md`
- **Summary:** The Bourbons catalog tab has filter chips for proof band, style, and age, but no way to filter by `availability_rarity` (everyday / seasonal / allocated / lottery). Now that these values are in the DB for most catalog bourbons, adding an "Availability" filter chip would let Paul and other members immediately surface "all the allocated bottles I can't get" vs "all the everyday pours." Zero AI cost; follows the same in-memory filter pattern already used by the other bourbon filters in `loadCatalogBrowse`.
- **Night Notes:**
  - 2026-06-02: Seeded. Three touch points: add `availability` field to `CatalogFilters` type, add a matching `passesFilters` branch in `catalog-queries.ts`, add a chip to `catalog-filter-controls.tsx`. ~1 hour. Blocked until IDEA-007 lands (availability data visible in subtitle = prerequisite for filter to feel discoverable).
  - 2026-06-03: IDEA-007 shipped — unblocked. Promoted to `planned`. Dev plan written.
  - 2026-06-07: 3-day stale rule (4 days since last priority change, no commits). Parked. Plan fully written — reclaim when ready for a 1-hour bourbon-catalog session.

---

### [IDEA-008] Winston hunt acknowledgment for allocated Want-shelf additions
- **Status:** parked
- **Category:** new
- **Seeded:** 2026-06-01
- **Last Updated:** 2026-06-04
- **Priority:** P3
- **Plan:** (not yet written)
- **Summary:** When a member marks an `availability_rarity: "allocated"` or `"lottery"` bottle as Want, show a small Winston `<Voice />` line in the cellar toggle UI ("A wise wish — the Pappy hunt is real."). This closes the emotional loop on the save action, acknowledging the hunting reality without blocking the UX. Zero AI cost: triggered by the `availability_rarity` field value already available in the client state.
- **Night Notes:**
  - 2026-06-01: Seeded. Small scope — needs `CellarToggle` to accept a `availabilityRarity` prop and render a Voice line when `want` flips to true for an allocated bottle. Lower priority than IDEA-007 (which surfaces the same data more broadly).
  - 2026-06-02: Reviewed. 1 day old. No commits. Holding at seed.
  - 2026-06-04: 3-day stale rule triggered (seeded 2026-06-01). No commits. Demoting to `parked`. IDEA-012 (Personal Hunt List) covers the hunting-awareness angle more holistically.

---

### [IDEA-011] Display subtitle in "Reach for next" cards (WinstonSuggests)
- **Status:** parked
- **Category:** enhance
- **Seeded:** 2026-06-03
- **Last Updated:** 2026-06-07
- **Priority:** P2
- **Plan:** `docs/nightshift/plans/DEVPLAN-IDEA-011-reach-for-next-subtitle.md`
- **Summary:** "Similar in tier" cards in `WinstonSuggests` already render `p.subtitle` (the availability/tier facts strip). "Reach for next" cards do not, creating a visual inconsistency. FIX-017 landed (commit `b1ac846`) — `subtitle` is now computed for shelf-scored items. This 10-minute JSX addition makes the two adjacent scroll sections consistent. Also the dead `YouMightAlsoLike` component (tracked as FIX-020) should be deleted at the same time.
- **Night Notes:**
  - 2026-06-03: Seeded and immediately promoted to `planned`. Directly depends on FIX-017. Dev plan written. Small scope, high visual consistency payoff.
  - 2026-06-04: FIX-017 landed in commit `b1ac846`. Dependency resolved. Promoting to `ready` — unblocked, plan exists, estimated 10 minutes.
  - 2026-06-07: 3-day stale rule (3 days since `ready` promotion, no commits). Parked. Dev plan fully written — this is a 10-minute grab when someone opens `winston-suggests.tsx`.

---

### [IDEA-012] Personal Hunt List on Cellar page
- **Status:** parked
- **Category:** new
- **Seeded:** 2026-06-03
- **Last Updated:** 2026-06-08
- **Priority:** P2
- **Plan:** (not yet written)
- **Summary:** A dedicated "Hunt List" section on the Cellar page (or You hub) that surfaces the member's Want-shelf items filtered to `allocated`, `lottery`, and `secondary-only` availability — the bottles that require active hunting rather than a store visit. Members often "want" unicorn bottles alongside everyday pours; mixing them in the Want list buries the hunts. Zero AI cost. Built on existing `member_saves.want` + `specs.availability_rarity` (now populated for most catalog bourbons). Grouped by difficulty: Lottery → Allocated → Secondary Only.
- **Night Notes:**
  - 2026-06-03: Seeded. Becomes meaningful only once most Want-shelf items have `availability_rarity` populated (currently catalog bourbons are covered; cigar wants are not). Two-step: (1) filter the Want list server-side by availability, (2) render a separate "Hunt List" section above the full Want shelf. Winston voice intro ("These are the ones worth hunting."). ~1.5–2 hours.
  - 2026-06-05: Verified cellar-section.tsx loads the Want shelf but does NOT filter by availability_rarity. The lib/cellar/ code has zero usage of `availability_rarity`. The data path is clear: `loadCellarProducts(supabase, memberId, "want")` → fetch `specs` join → filter where `specs.availability_rarity IN (allocated, lottery, secondary-only)`. Promoting to `exploring`. Estimate: 1.5 hours. Blocked by no hard dependency but most meaningful after IDEA-010 (availability filter chip) lands to set member expectations about availability tiers.
  - 2026-06-08: 3-day stale rule (5 days at exploring, no commits). Parked. Data path is clear; reclaim when Want-shelf polish session begins.

---

### [IDEA-013] Club recommendation count badge on catalog cards
- **Status:** parked
- **Category:** enhance
- **Seeded:** 2026-06-04
- **Last Updated:** 2026-06-07
- **Priority:** P2
- **Plan:** `docs/nightshift/plans/DEVPLAN-IDEA-013-catalog-rec-count-badge.md`
- **Summary:** `loadCatalogBrowse` already computes `rec_count` per product (it drives the "Recommended" sort order) but strips it before returning `CatalogEntry`. Exposing it and rendering a "N club recs" label below the subtitle on catalog cards gives members a quality signal when browsing — especially useful when filtering by availability or style. Zero AI cost. Threshold: show only for 2+ recs to avoid noise.
- **Night Notes:**
  - 2026-06-04: Seeded and immediately promoted to `planned`. Data is already computed — just not threaded through to the UI. 45 minutes, no migrations. Dev plan written.
  - 2026-06-07: 3-day stale rule (3 days since planning, no commits). Parked. Plan fully written — reclaim when doing a catalog browse polish session.

---

### [IDEA-014] Meetup event day banner on the feed
- **Status:** parked
- **Category:** new
- **Seeded:** 2026-06-04
- **Last Updated:** 2026-06-08
- **Priority:** P2
- **Plan:** `docs/nightshift/plans/DEVPLAN-IDEA-014-meetup-tonight-banner.md`
- **Summary:** When a meetup event in the `events` table has `date` matching today, show a Winston `<Voice />` banner at the top of the feed's "For You" tab linking to the pairing capture page. The club meets in-person regularly; this feeds the feedback loop by surfacing "tonight is a meetup" in the app members already have open. Zero AI cost (text template); the `events` query already runs in `FeedList` — just needs a `isTonightMeetup` boolean derived from `upcoming.date === today`.
- **Night Notes:**
  - 2026-06-04: Seeded. The `events` table and `event_id` on tastings already exist. The feed page is a server component — a single `.eq("date", todayKey())` query costs ~5ms. P2 because it's the kind of detail that makes the club feel alive.
  - 2026-06-05: Scanned `page.tsx` and `meetup-card.tsx`. The feed already fetches `upcoming` events with `gte("date", today)` — no new query needed. `MeetupCard` just needs a companion `MeetupTonightBanner` component that fires when `upcoming.date === today`. Dev plan written. Estimate: 30 minutes.
  - 2026-06-08: 3-day stale rule (4 days at planned, no commits). Parked. **Note:** FIX-025 (UTC date bug in FeedList) must also be applied when implementing this — use `en-CA` ET locale for `today` to avoid banner disappearing at 8pm EDT. Dev plan and fix plan both ready.

---

### [IDEA-015] Club tasting digest export for meetup nights
- **Status:** parked
- **Category:** new
- **Seeded:** 2026-06-05
- **Last Updated:** 2026-06-08
- **Priority:** P3
- **Plan:** (not yet written)
- **Summary:** An admin-only action that generates a plain-text or JSON digest of all tastings from a specific event — product names, recommend flags, member chips, and free notes — downloadable or copy-pasteable. Useful for Paul's post-meetup recap email or group text. Zero AI cost. Data is already in `tastings` + `events` + `products` tables. Could be a simple `/admin/meetup/[id]/digest` route with a `<pre>` block.
- **Night Notes:**
  - 2026-06-05: Seeded. Grounded in the existing `events` table and `event_id` on tastings. Very practical for 12-person group social layer. Low complexity (pure DB query + text render). P3 because it's a convenience feature, not a core loop.
  - 2026-06-08: 3-day stale rule triggered. Parked. Low priority P3 — reclaim when post-meetup workflow becomes a pain point.

---

### [IDEA-016] My notes pinned at top in "The club says"
- **Status:** parked
- **Category:** enhance
- **Seeded:** 2026-06-05
- **Last Updated:** 2026-06-08
- **Priority:** P3
- **Plan:** (not yet written)
- **Summary:** The `ClubVoice` component already extracts `myTake` and shows it in a "Your notes" section — but it renders at the BOTTOM of the card, after all other members' takes. On a well-tasted product with 8+ member notes, the member has to scroll past everyone else before seeing their own notes. Reorder so the "Your notes" section appears first (before other members' takes), making the product detail feel personal before it feels social.
- **Night Notes:**
  - 2026-06-05: Seeded. Found while scanning `club-voice.tsx`. The `myTake` and `otherTakes` are already separated. It's a single JSX reorder: move `{myTake ? <YourNotes ...> : null}` above `{otherTakes.length > 0 ? <MemberTakes ...> : null}`. Zero DB changes. Aesthetic / UX question for Paul — hence P3. ~5 minutes to implement.
  - 2026-06-08: 3-day stale rule triggered. Parked. P3 aesthetic question for Paul — needs a preference call before implementing. Trivial to reclaim when asked.

---

### [IDEA-017] Bourbon-specific explore links on product detail
- **Status:** parked
- **Category:** enhance
- **Seeded:** 2026-06-06
- **Last Updated:** 2026-06-09
- **Priority:** P2
- **Plan:** `docs/nightshift/plans/DEVPLAN-IDEA-017-bourbon-explore-links.md`
- **Summary:** The `ExploreLinks` component shows cigar-specific research links (CigarPage, Cigar Aficionado) on cigar product detail, but bourbon product detail has no equivalent "Explore" section. Adding a `productType` prop and bourbon-specific links (Whiskybase, Distiller.com) completes the research surface for bourbons. 30 minutes, no AI cost, no DB changes — two new link arrays and a prop.
- **Night Notes:**
  - 2026-06-06: Seeded and immediately promoted to `planned`. `ExploreLinks` is already guarded `{productType === "cigar" ? ...}` in product detail; just needs to accept a `productType` prop and select the right link set. Dev plan written.
  - 2026-06-09: 3-day stale rule triggered (3 days at planned, no commits). Parked. Dev plan fully written — reclaim in a 30-min bourbon product-detail polish session.

---

### [IDEA-018] Native share sheet for product pages (PWA)
- **Status:** parked
- **Category:** new
- **Seeded:** 2026-06-06
- **Last Updated:** 2026-06-09
- **Priority:** P3
- **Plan:** (not yet written)
- **Summary:** Add a "Share" icon button to product detail that triggers `navigator.share()` with the product name and app deep-link URL. Falls back to copy-to-clipboard on browsers that don't support the Web Share API (e.g. desktop). The 12 club members share product links in group texts frequently; a native share sheet eliminates copy-paste friction. Zero AI cost, no new DB columns — purely a client-side `"use client"` wrapper around the platform Share API.
- **Night Notes:**
  - 2026-06-06: Seeded. `navigator.share()` is supported on all modern iOS Safari versions (PWA target). Implementation: a small `ShareButton` client component with `type="button"` and a share icon (e.g. `lucide-react` `Share2`). Place in the product detail header alongside the edit pencil link. The `href` is `window.location.href` (the canonical deep-link). ~30 minutes.
  - 2026-06-09: 3-day stale rule triggered (3 days at seed, no commits). Parked. P3 UX convenience — reclaim when Paul asks for native sharing from product detail.

---

### [IDEA-019] Club want-count hint on Want shelf
- **Status:** parked
- **Category:** enhance
- **Seeded:** 2026-06-07
- **Last Updated:** 2026-06-10
- **Priority:** P2
- **Plan:** `docs/nightshift/plans/DEVPLAN-IDEA-019-want-overlap-count.md`
- **Summary:** When a member views their own Want shelf on the Cellar page, show "N others want this" beneath the subtitle for any bottle that 2+ other club members also want. Turns the Want shelf into a visible hunting-together signal for the 12-person group without creating public profiles or follower counts. Pure server-side aggregate of `member_saves.want`. Zero AI cost, no migrations. ~45 minutes.
- **Night Notes:**
  - 2026-06-07: Seeded and immediately promoted to `planned`. Data path is clear: `SELECT product_id FROM member_saves WHERE want=true AND member_id != :me`, aggregate counts, pass to `CellarSection` as a Map. Dev plan written.
  - 2026-06-10: 3-day stale rule (3 days at planned, no commits). Parked. Dev plan fully written — reclaim in a Cellar/Want-shelf polish session.

---

### [IDEA-020] Branded error.tsx and not-found.tsx for the app shell
- **Status:** parked
- **Category:** new
- **Seeded:** 2026-06-07
- **Last Updated:** 2026-06-10
- **Priority:** P2
- **Plan:** `docs/nightshift/plans/DEVPLAN-IDEA-020-error-not-found-pages.md`
- **Summary:** The app has no `error.tsx` or `not-found.tsx` files. Runtime errors and 404s show Next.js default pages — unbranded and jarring for a private PWA. Adding a `(app)/(shell)/error.tsx` (client component error boundary with Winston voice + retry button) and `app/not-found.tsx` (server component 404 with Winston voice + home link) gives every failure state the same club character as the rest of the app. ~30 minutes, zero AI cost, no DB changes.
- **Night Notes:**
  - 2026-06-07: Seeded and immediately promoted to `planned`. Confirmed no `error.tsx` or `not-found.tsx` exists anywhere in the app. Two new files, self-contained, no dependencies. Dev plan written.
  - 2026-06-10: 3-day stale rule (3 days at planned, no commits). Parked. Dev plan fully written — reclaim in a 30-min polish session for any unbranded error state.

---

### [IDEA-009] Scene upload workflow — `--upload` flag for generate-catalog-scenes.ts
- **Status:** parked
- **Category:** enhance
- **Seeded:** 2026-06-02
- **Last Updated:** 2026-06-07
- **Priority:** P2
- **Plan:** `docs/nightshift/plans/DEVPLAN-IDEA-009-scene-upload-workflow.md`
- **Summary:** The `generate-catalog-scenes.ts` script writes glamour shots to `scripts/media/out/` with no upload step. After Paul reviews and approves the output, he must manually push each image through the admin UI — defeating the batch workflow. Adding `--upload` (commit) and `--dry-run-upload` (plan only) flags reads `out/`, matches files to products by the `{productId}--{sceneSlug}.jpg` filename pattern, and bulk-pushes to the `product-catalog` Supabase bucket with a `products.image_url` update per row. ~1 hour, no new UI, no migrations.
- **Night Notes:**
  - 2026-06-02: Seeded and immediately promoted to `planned`. The script already uses `adminClient()`; the upload path is a straight port of the pattern in `api/product-photo/route.ts`. Self-contained enhancement to the new script — closes the workflow loop from generate → review → publish.
  - 2026-06-07: 3-day stale rule (5 days, no commits). Parked. Plan still valid — reclaim when scene-generation workflow resumes.

---

### [IDEA-021] Tonight's Pick empty-shelf Winston voice
- **Status:** parked
- **Category:** enhance
- **Seeded:** 2026-06-08
- **Last Updated:** 2026-06-11
- **Priority:** P2
- **Plan:** `docs/nightshift/plans/DEVPLAN-IDEA-021-tonights-pick-empty-state.md`
- **Summary:** When `TonightsPickSection` on the cellar page has no pick to show (empty Have shelf or no opposite-type pair available), it currently returns `null` silently. Adding a Winston `<Voice />` empty state — "The shelf's bare. Add something to have on hand and I'll pick tonight's pour." — with a "Browse bourbons →" link closes the feedback loop and gives first-time cellar visitors a reason to start adding bottles. 5-minute change, zero AI cost, no DB changes.
- **Night Notes:**
  - 2026-06-08: Seeded and immediately promoted to `planned`. Noticed the bare `return null` while verifying FIX-024. The `<Voice />`, `<Link>`, `<Divider>`, and `cn` are all already imported in the file — truly zero new imports. Dev plan written.
  - 2026-06-11: 3-day stale rule triggered (seeded 2026-06-08, no commits). Parked. A 5-minute grab — dev plan written and ready to execute immediately.

---

### [IDEA-022] Admin product merge tool
- **Status:** parked
- **Category:** new
- **Seeded:** 2026-06-08
- **Last Updated:** 2026-06-13
- **Priority:** P2
- **Plan:** `docs/nightshift/plans/DEVPLAN-IDEA-022-admin-product-merge.md`
- **Summary:** As more members capture products, the DB will accumulate duplicates — two rows representing the same bourbon or cigar, each with partial tastings and saves. There's currently no admin mechanism to merge them. An `/admin/products/merge` page would accept a primary UUID (keep) and a secondary UUID (archive), then: (1) UPDATE all `tastings.product_id` from secondary to primary, (2) upsert `member_saves` by taking the OR of each flag per member, (3) copy `product_images` rows to primary, (4) set `products.status = 'archived'` on secondary. No AI cost, no new migrations, pure SQL/Supabase client logic. ~2 hours.
- **Night Notes:**
  - 2026-06-08: Seeded. The existing admin pages (`admin/invites`, `admin/catalog`, `admin/suggestions`) establish a clear pattern: server component page with server action forms. A merge page fits that mold exactly. The `tastings` re-parent is a single UPDATE; the `member_saves` merge needs a per-member check (SELECT existing row, upsert combining flags). Self-contained, low risk since secondary gets archived not deleted.
  - 2026-06-10: Promoted to `planned`. Dev plan written (DEVPLAN-IDEA-022). 3 phases: form + auth guard, merge logic (6-step atomic sequence), polish (preview panel + post-merge voice line). Estimated 2 hours. Blocked by no hard dependency.
  - 2026-06-13: 3-day stale rule triggered (3 days at `planned`, no commits). Parked. Dev plan fully written and ready — reclaim for a 2-hour admin session.

---

### [IDEA-023] "Tasted by N members" count in ClubVoice
- **Status:** ready
- **Category:** enhance
- **Seeded:** 2026-06-09
- **Last Updated:** 2026-06-11
- **Priority:** P2
- **Plan:** `docs/nightshift/plans/DEVPLAN-IDEA-023-tasted-by-count.md`
- **Summary:** Add `taster_count: number` to `GroupVoice` and display "Tasted by N of 12 members" in the ClubVoice section on product detail. Computed from the already-fetched tastings array as `new Set(tastings.map(t => t.user_id)).size` — zero extra DB queries. Gives members an instant quorum signal before reading the aggregate voice: "9 of 12 members weighed in" vs. "2 of 12." 30 minutes, zero AI cost, no migrations.
- **Night Notes:**
  - 2026-06-09: Seeded and immediately promoted to `planned`. `loadGroupVoice` already fetches all tasting rows for the product. The distinct-user count is a client-side dedup of an already-loaded array. Three touch points: type, computation, rendering. Dev plan written with unit test coverage.
  - 2026-06-11: Promoted to `ready`. Dev plan is fully self-contained (DEVPLAN-IDEA-023). No dependencies. Zero new queries. Executable in 30 minutes.

---

### [IDEA-024] Quick Want-shelf toggle on catalog cards
- **Status:** done
- **Category:** new
- **Seeded:** 2026-06-09
- **Last Updated:** 2026-06-11
- **Done:** 2026-06-11 (already shipped — discovered on scan)
- **Priority:** P2
- **Plan:** (none needed — already implemented)
- **Summary:** A small bookmark icon on bourbon catalog cards that toggles `member_saves.want` inline without navigating to product detail.
- **Night Notes:**
  - 2026-06-09: Seeded and promoted to `exploring`. Architecture questions: (a) optimistic state; (b) tap-target placement.
  - 2026-06-11: Scanned `CatalogCard` and `CellarCardControls`. This feature is **already fully implemented**. `CatalogCard` renders `CellarCardControls` (tried / have / want / love toggle buttons) when `cellarState != null`. The feed page passes `cellarState={showCellar ? cellarState : null}` where `showCellar = Boolean(viewerId)` — true for any authenticated member. Architecture questions were already solved: `CellarCardControls` uses `useState` + `startTransition` for optimistic updates and `e.stopPropagation()` to avoid navigating. The 2026-06-09 nightshift scan missed this existing component.

---

### [IDEA-025] "Your note" one-line preview on feed tasting cards
- **Status:** done
- **Category:** enhance
- **Seeded:** 2026-06-10
- **Last Updated:** 2026-06-11
- **Done:** 2026-06-11 (already shipped — discovered on scan)
- **Priority:** P2
- **Plan:** (none needed — already implemented)
- **Summary:** Feed tasting cards show a one-line truncated note preview when `note` is non-empty.
- **Night Notes:**
  - 2026-06-10: Seeded. Confirmed `note` included in feed query. Described as missing from tasting card.
  - 2026-06-11: Scanned `TastingCard` (lines 108–112) and `PairingFeedCard` (lines 92–96). **Both already render the note inline** — `TastingCard` with `truncate` single-line, `PairingFeedCard` with `line-clamp-2`. `FeedTastingEntry.note` is fetched in the query. The 2026-06-10 nightshift seeded this as missing but the feature already existed in both card components.

---

### [IDEA-027] Cellar hint dots on WinstonSuggests suggestion cards
- **Status:** planned
- **Category:** enhance
- **Seeded:** 2026-06-11
- **Last Updated:** 2026-06-12
- **Priority:** P2
- **Plan:** `docs/nightshift/plans/DEVPLAN-IDEA-027-cellar-hint-dots.md`
- **Summary:** `WinstonSuggests` renders "Reach for Next" (horizontal scroll), "Hunt Next" (TryNextPick rationale), and "Similar in Tier" / "Pairs Well With" cards (vertical list). These cards show product name + subtitle but give no indication of the member's cellar relationship to the product — whether they already Have it, Want it, or have Tried it. A member browsing suggestions has to navigate into each card to see their relationship. Adding tiny inline cellar-state indicators (small "Have" / "Want" / "Tried" badge dots, not the full toggle control) to suggestion cards would let members scan suggestions immediately. The cellar snapshot is already loaded in `loadProductSuggestions` for the shelf-first pairing logic — it could be threaded through to the card render. Zero AI cost, no DB changes.
- **Night Notes:**
  - 2026-06-11: Seeded. Promoted to `exploring` immediately — architecture is clear in principle but needs a closer look at how `loadProductSuggestions` passes data to `WinstonSuggests` and which suggestion card components exist. Key questions: (a) Is the cellar snapshot already available at the `WinstonSuggests` component boundary, or does it need to be fetched again? (b) Should this be full `CellarCardControls` (toggle) or read-only indicator dots? Given that WinstonSuggests cards are compact suggestion items (not the primary browsing surface), read-only indicator dots are appropriate — full controls would crowd the suggestion layout. Estimate: 45 min once architecture confirmed.
  - 2026-06-12: Architecture fully confirmed via nightshift subagent scan. `cellarSnapshot` is fetched inside `loadProductSuggestions` but not returned to the page. All suggestion items have `product_id`; `CrossTypePick` has `cigar_id`/`bourbon_id`. Fix: extend `loadProductSuggestions` return type to `{ suggestions, cellarSnapshot }` (zero new DB queries — reuses already-fetched data). Create a new read-only `CellarStatusDots` component (~100 lines). Thread snapshot prop through page → WinstonSuggests. `loved` flag excluded (private signal). Promoted to `planned`. Dev plan written at `DEVPLAN-IDEA-027-cellar-hint-dots.md`. Estimate: 45 min.

---

### [IDEA-028] "New to the shelf" catalog additions section in For You feed
- **Status:** seed
- **Category:** new
- **Seeded:** 2026-06-11
- **Last Updated:** 2026-06-11
- **Priority:** P2
- **Plan:** (not yet written)
- **Summary:** When Paul adds a new bourbon or cigar to the catalog (sets `catalog_included = true`), club members have no way to discover it except browsing the full catalog. Adding a "New to the NCCC shelf" section at the top of the For You feed tab — showing products with `catalog_included = true` and `created_at` within the last 30 days (or a `catalog_added_at` timestamp if we want precision) — makes catalog additions feel like events. Each new product gets the same card treatment as catalog browse cards, with a "Recently added" pill. Zero AI cost; one extra query on the For You feed load: `SELECT * FROM products WHERE catalog_included = true AND created_at > now() - interval '30 days' LIMIT 5`. If no new products in 30 days, the section is hidden silently. ~1 hour.
- **Night Notes:**
  - 2026-06-11: Seeded. The 30-day window + `catalog_included` filter is straightforward. Potential refinement: track `catalog_added_at` separately from `created_at` since a product created months ago might be added to the catalog now — `created_at` would not reflect the catalog-add event. Could use `products.updated_at` as a proxy when `catalog_included` changes, but that column is set by trigger for all updates. A cleaner approach: add a `catalog_included_at` timestamp column (nullable; set when `catalog_included` transitions true → false → true is tracked). For now, using `created_at` is an acceptable approximation for Phase-10 scope. P2 because it closes the discovery loop for new catalog additions without requiring any notifications infrastructure.

---

### [IDEA-026] Event tasting recap page
- **Status:** seed
- **Category:** new
- **Seeded:** 2026-06-10
- **Last Updated:** 2026-06-10
- **Priority:** P2
- **Plan:** (not yet written)
- **Summary:** A per-event recap page at `/events/[id]` (member-readable, not admin-only) showing all tastings from that specific meetup: products covered, who recommended what, combined flavor chips, and the best pairing score among pairings captured that night. The `tastings.event_id` field already exists; this is a simple group-by query with product joins. Complements IDEA-015 (parked admin digest) but from a member-facing, in-app perspective. Gives the club a lightweight meetup history that lives in the app rather than a group text. ~1.5 hours, zero AI cost, no new migrations.
- **Night Notes:**
  - 2026-06-10: Seeded. `tastings.event_id`, `events`, and `pairing_sessions` tables are all in place. The event-night context already surfaces in the feed's "Last meetup" card — this extends that into a full-page view. Key data points: products tasted (unique product_ids from event tastings), recommend rate per product, top chips, and best pairing score from `pairings_cache` for any pair captured that night. The recap page could also serve as a landing for future push-notification links ("Last night's meetup recap is ready"). P2 because it adds long-term club memory without any complexity or cost.

---

### [IDEA-029] Re-taste shortcut from tasting history
- **Status:** planned
- **Category:** enhance
- **Seeded:** 2026-06-12
- **Last Updated:** 2026-06-13
- **Priority:** P2
- **Plan:** `docs/nightshift/plans/DEVPLAN-IDEA-029-retaste-shortcut.md`
- **Summary:** The `/you/tastings` history page shows each tasting card (product, chips, note, date) but has no quick path back to the recommend form to log a follow-up tasting. Adding a "Try again →" link per card that navigates to `/products/{id}/recommend?release_label={label}` lets members quickly log a follow-up tasting for a new vintage without searching for the product again. Especially useful for annual releases (e.g., Buffalo Trace Antique Collection each fall). ~20 minutes, zero AI cost, no DB changes — one JSX link added to `TastingSection` card render.
- **Night Notes:**
  - 2026-06-12: Seeded. The `TastingsSection` component already receives product name and product_id per tasting row, and `release_label` is in the tasting query. The link is a pre-populated deep-link to the existing recommend form. The "Try again" label is intentionally casual — matches the club voice. P2 because it closes a real friction point for members who taste the same product across vintages.
  - 2026-06-13: Confirmed architecture: `TastingCard` is the correct file (wraps card in `<Link>`; add inner `<a>` with `e.stopPropagation()`). `TastingsSection` needs a `showRetaste?: boolean` prop; pass `showRetaste={true}` from `/you/tastings/page.tsx` only (not from `members/[id]` profile). Full dev plan written. Promoting seed → `planned`. Estimated 20 minutes.

---

### [IDEA-030] Club Bulletin Board — admin-pinned message in For You feed
- **Status:** seed
- **Category:** new
- **Seeded:** 2026-06-12
- **Last Updated:** 2026-06-12
- **Priority:** P2
- **Plan:** (not yet written)
- **Summary:** Paul (admin) can post a short text message from the admin panel that appears as a Winston `<Voice />` card at the top of the For You feed tab until dismissed. Use case: "Next meetup is June 19 at the usual spot" or "New Weller Antique batch just hit Brown-Forman Cask." Members dismiss per-session via `localStorage` keyed to the bulletin ID. Zero AI cost. DB: a `club_bulletin` table (id UUID, message text, active boolean, created_at). Admin: a simple `/admin/bulletin` page with textarea + save action. For You feed: one extra query `SELECT * FROM club_bulletin WHERE active = true LIMIT 1`. If no active bulletin, section is hidden. ~1.5 hours, 1 migration.
- **Night Notes:**
  - 2026-06-12: Seeded. The `events` table already exists for meetup dates — but a bulletin is more flexible (not tied to a scheduled event). The dismissal approach uses `localStorage` rather than a server-side table to avoid a new join on every feed load and keep the feature self-contained. The admin bulletin page follows the same server-action pattern as `/admin/invites` and `/admin/catalog`. Winston voice card uses the `<Voice>` primitive + a dismiss button in a `"use client"` wrapper. P2 because it gives Paul a lightweight club-wide broadcast channel that doesn't require the group text.

---

### [IDEA-031] Pairing compatibility score on pairing detail page
- **Status:** planned
- **Category:** enhance
- **Seeded:** 2026-06-13
- **Last Updated:** 2026-06-13
- **Priority:** P2
- **Plan:** `docs/nightshift/plans/DEVPLAN-IDEA-031-pairing-score-display.md`
- **Summary:** The pairing detail page at `/pairings/[cigarId]/[bourbonId]` shows Winston's AI prose and "Why it works" bullets but never surfaces the computed compatibility score for the headline pair. The alternative bourbons list at the bottom does show tier labels ("Excellent match", "Good match") — the omission from the header makes the page feel incomplete and leaves members guessing how strongly Winston endorses this specific combination. The score is free to compute: both trait vectors are already fetched for the page; `scorePair(cigar.trait_vector, bourbon.trait_vector)` is one in-process call. Add a tier-label badge in the page header. Zero AI cost, zero new DB queries. ~20 minutes.
- **Night Notes:**
  - 2026-06-13: Seeded and immediately promoted to `planned`. Architecture confirmed: `cigar.trait_vector` and `bourbon.trait_vector` are both guaranteed non-null by line 44's notFound guard. Import `scorePair` from `@/lib/pairing/score`; call it inline. `pairingTierLabel` is already imported in the page (line 9). Render a small etched-glass tier badge in the header between "Winston suggests" and the cigar name. Dev plan written. Estimated 20 minutes.

---

### [IDEA-032] Group chip hints on the recommend form
- **Status:** seed
- **Category:** new
- **Seeded:** 2026-06-13
- **Last Updated:** 2026-06-13
- **Priority:** P2
- **Plan:** (not yet written)
- **Summary:** When a member starts a new tasting on `/products/[id]/recommend`, the chip picker shows every chip from the full flavor wheel — no guidance on what the club has found relevant for this product. The product's `GroupVoice.tag_cloud` already aggregates all previous tastings into a ranked set of flavor labels. Surfacing the top 4–5 as tappable "Others have noted: earthy, cedar, medium body" chips above the main picker gives new members context and helps experienced members quickly re-confirm shared notes. Server-side: `tag_cloud` is computed by `loadGroupVoice` and already exists on the product detail page — it needs to be passed to the recommend page as well. Client-side: a small `GroupChipHints` component renders the top cloud entries as selectable ghost chips. Tapping one pre-selects it in the active chip state. Zero AI cost, no DB changes. ~45 minutes (threading GroupVoice from server page to client chip picker is the main work).
- **Night Notes:**
  - 2026-06-13: Seeded. The recommend page (`/products/[id]/recommend/page.tsx`) currently loads tasting history for release-label detection but not the full group voice. Adding `loadGroupVoice(supabase, productId, productType)` to the server page is one extra call. The chip picker is a client component — the tag_cloud would be passed as a prop serialized from the server. Key constraint: the chip picker must remain the single source of truth for selection state; hint chips only pre-populate it, not replace it. P2 because it directly improves tasting quality by reducing "I don't know what to pick" friction for less-experienced members.
