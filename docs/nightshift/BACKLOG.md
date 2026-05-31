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
- **Status:** seed
- **Category:** enhance
- **Seeded:** 2026-05-30
- **Last Updated:** 2026-05-31
- **Priority:** P3
- **Plan:** (not yet written)
- **Summary:** When a member reaches a new badge milestone, show a Winston congratulation block at the top of the You hub (one-time dismissible via `localStorage`). The badge system already computes `nextBadge`; this closes the feedback loop so members notice when they level up.
- **Night Notes:**
  - 2026-05-30: Seeded. Needs a mechanism to detect "just earned" — probably a `last_seen_badge_level` column in `users` or a client-side localStorage check. Mild complexity; park until cellar / maker work lands.
  - 2026-05-31: Reviewed. Maker pages and MCP work landed today. Still no commits touching badges. P3 remains appropriate — not yet stale (2 days old).

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

## Category 2 — New Feature or Integration

### [IDEA-003] Phase 9 — Maker & Distillery pages
- **Status:** done
- **Category:** new
- **Seeded:** 2026-05-30
- **Last Updated:** 2026-05-30
- **Done:** 2026-05-30
- **Priority:** P1
- **Plan:** `docs/nightshift/plans/DEVPLAN-IDEA-003-maker-pages.md`
- **Summary:** Tappable maker/distillery pages keyed by brand name. Each page shows a Winston blurb (AI-generated, admin-editable), country/region, the club's catalog from that house, and a one-line house-style read derived from aggregated `trait_vector` across the maker's products. Turns dead brand text on product detail into an explorable surface. Fully specced in `planning/nccc-implementation-plan.md` Phase 9.
- **Night Notes:**
  - 2026-05-30: Seeded + immediately promoted to `planned`. `catalog_hierarchy` migration already landed (20260527000001). Bourbon catalog is well-seeded. Phase 9 plan from spec is detailed; dev plan can lift directly from it. P1 because it's the next major feature in the roadmap.

---

### [IDEA-004] Personal stats mini-dashboard on You hub
- **Status:** seed
- **Category:** new
- **Seeded:** 2026-05-30
- **Last Updated:** 2026-05-31
- **Priority:** P3
- **Plan:** (not yet written)
- **Summary:** A small "By the numbers" card on the You hub showing: total tastings, total pairings, favorite wrapper, favorite bourbon style, strongest vs. mildest cigars tried — derived from `tastings` + `member_saves` data already in DB. Phase 8.4 in the plan, not yet implemented.
- **Night Notes:**
  - 2026-05-30: Seeded. Mentioned in nccc-implementation-plan.md as Phase 8.4. Pure DB aggregation — no AI cost. Lower priority than maker pages; park unless P&L asks for it.
  - 2026-05-31: Reviewed. Still 1 day old. No commits. Holding at seed.

---

### [IDEA-006] MCP `get_member_tastings` tool
- **Status:** seed
- **Category:** new
- **Seeded:** 2026-05-31
- **Last Updated:** 2026-05-31
- **Priority:** P3
- **Plan:** (not yet written)
- **Summary:** Add a `get_member_tastings` tool to the MCP server so members can ask Claude "what have I tried?" and get a paginated history of their tastings with product names, recommend flags, chips, and notes. Currently `get_my_cellar` shows shelf state (have/want/tried/loved counts) and `get_club_feed` shows recent club activity, but there's no way to query one member's full personal history.
- **Night Notes:**
  - 2026-05-31: Seeded. The MCP server now has 9 tools; this would be the 10th. `loadFeed` already accepts a `userId` filter. Low effort — maybe 1 hour — but lower priority than makers browse since the cellar shelf gives a reasonable approximation.
