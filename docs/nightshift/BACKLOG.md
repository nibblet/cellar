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
- **Status:** seed
- **Category:** new
- **Seeded:** 2026-05-31
- **Last Updated:** 2026-06-02
- **Priority:** P3
- **Plan:** (not yet written)
- **Summary:** Add a `get_member_tastings` tool to the MCP server so members can ask Claude "what have I tried?" and get a paginated history of their tastings with product names, recommend flags, chips, and notes. Currently `get_my_cellar` shows shelf state (have/want/tried/loved counts) and `get_club_feed` shows recent club activity, but there's no way to query one member's full personal history.
- **Note:** `docs/nightshift/plans/DEVPLAN-IDEA-006-pair-me-ux.md` exists from a pre-nightshift session — it documents the shipped Pair-Me UX / WinstonSuggests feature, not this tool. That plan file is orphaned shipped-work documentation; it does not belong to this backlog entry.
- **Night Notes:**
  - 2026-05-31: Seeded. The MCP server now has 9 tools; this would be the 10th. `loadFeed` already accepts a `userId` filter. Low effort — maybe 1 hour — but lower priority than makers browse since the cellar shelf gives a reasonable approximation.
  - 2026-06-01: Reviewed. 1 day old. No commits. Holding at seed — not yet stale.
  - 2026-06-02: 2 days old. No commits. Approaching 3-day stale threshold (triggers tomorrow 2026-06-03 if no action). Holding at seed tonight.

---

### [IDEA-007] Surface availability_rarity + cobbTier on catalog cards and product detail
- **Status:** planned
- **Category:** enhance
- **Seeded:** 2026-06-01
- **Last Updated:** 2026-06-02
- **Priority:** P2
- **Plan:** `docs/nightshift/plans/DEVPLAN-IDEA-007-availability-tier-on-catalog-cards.md`
- **Summary:** The bourbon CSV seed now populates `specs.availability_rarity` (allocated/lottery/seasonal/…) and `specs.tier` (1–5). These exist in the DB but are invisible in the UI — neither the catalog card subtitle nor the product detail header show them. Extending `composeProductSubtitle` to emit "Allocated" / "Tier N" tokens makes the catalog self-documenting for members browsing or hunting. Note: `FactsStrip` on product detail already shows `availabilityLabel`; the gap is the browse-card subtitle only.
- **Night Notes:**
  - 2026-06-01: Seeded and immediately promoted to `planned`. Zero AI cost, zero DB changes, zero migrations. Data is already there; it just needs to flow through `composeProductSubtitle`. ~1 hour of work. High signal: members will finally be able to see which bottles are Allocated without opening each product detail.
  - 2026-06-02: Reviewed. Not yet implemented (no commits touching composeProductSubtitle). Holding at planned. Still 1 day old; no stale risk.

---

### [IDEA-010] Availability filter chip in bourbon catalog browse
- **Status:** seed
- **Category:** new
- **Seeded:** 2026-06-02
- **Last Updated:** 2026-06-02
- **Priority:** P2
- **Plan:** (not yet written)
- **Summary:** The Bourbons catalog tab has filter chips for proof band, style, and age, but no way to filter by `availability_rarity` (everyday / seasonal / allocated / lottery). Now that these values are in the DB for most catalog bourbons, adding an "Availability" filter chip would let Paul and other members immediately surface "all the allocated bottles I can't get" vs "all the everyday pours." Zero AI cost; follows the same in-memory filter pattern already used by the other bourbon filters in `loadCatalogBrowse`. Pairs with IDEA-007 (surface the same data in the subtitle).
- **Night Notes:**
  - 2026-06-02: Seeded. Three touch points: add `availability` field to `CatalogFilters` type, add a matching `passesFilters` branch in `catalog-queries.ts`, add a chip to `catalog-filter-controls.tsx`. ~1 hour. Blocked until IDEA-007 lands (availability data visible in subtitle = prerequisite for filter to feel discoverable).

---

### [IDEA-008] Winston hunt acknowledgment for allocated Want-shelf additions
- **Status:** seed
- **Category:** new
- **Seeded:** 2026-06-01
- **Last Updated:** 2026-06-02
- **Priority:** P3
- **Plan:** (not yet written)
- **Summary:** When a member marks an `availability_rarity: "allocated"` or `"lottery"` bottle as Want, show a small Winston `<Voice />` line in the cellar toggle UI ("A wise wish — the Pappy hunt is real."). This closes the emotional loop on the save action, acknowledging the hunting reality without blocking the UX. Zero AI cost: triggered by the `availability_rarity` field value already available in the client state.
- **Night Notes:**
  - 2026-06-01: Seeded. Small scope — needs `CellarToggle` to accept a `availabilityRarity` prop and render a Voice line when `want` flips to true for an allocated bottle. Lower priority than IDEA-007 (which surfaces the same data more broadly).
  - 2026-06-02: Reviewed. 1 day old. No commits. Holding at seed.

---

### [IDEA-009] Scene upload workflow — `--upload` flag for generate-catalog-scenes.ts
- **Status:** planned
- **Category:** enhance
- **Seeded:** 2026-06-02
- **Last Updated:** 2026-06-02
- **Priority:** P2
- **Plan:** `docs/nightshift/plans/DEVPLAN-IDEA-009-scene-upload-workflow.md`
- **Summary:** The `generate-catalog-scenes.ts` script writes glamour shots to `scripts/media/out/` with no upload step. After Paul reviews and approves the output, he must manually push each image through the admin UI — defeating the batch workflow. Adding `--upload` (commit) and `--dry-run-upload` (plan only) flags reads `out/`, matches files to products by the `{productId}--{sceneSlug}.jpg` filename pattern, and bulk-pushes to the `product-catalog` Supabase bucket with a `products.image_url` update per row. ~1 hour, no new UI, no migrations.
- **Night Notes:**
  - 2026-06-02: Seeded and immediately promoted to `planned`. The script already uses `adminClient()`; the upload path is a straight port of the pattern in `api/product-photo/route.ts`. Self-contained enhancement to the new script — closes the workflow loop from generate → review → publish.
