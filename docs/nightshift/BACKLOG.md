# NCCC — Ideas Backlog

Maturity: seed → exploring → planned → ready → parked

---

## Category 1 — Enhance Existing

### [IDEA-001] Cellar-aware "Tonight's Pick" Winston line on Cellar page header
- **Status:** planned
- **Category:** enhance
- **Seeded:** 2026-05-30
- **Last Updated:** 2026-05-30
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
- **Last Updated:** 2026-05-30
- **Priority:** P3
- **Plan:** (not yet written)
- **Summary:** When a member reaches a new badge milestone, show a Winston congratulation block at the top of the You hub (one-time dismissible via `localStorage`). The badge system already computes `nextBadge`; this closes the feedback loop so members notice when they level up.
- **Night Notes:**
  - 2026-05-30: Seeded. Needs a mechanism to detect "just earned" — probably a `last_seen_badge_level` column in `users` or a client-side localStorage check. Mild complexity; park until cellar / maker work lands.

---

## Category 2 — New Feature or Integration

### [IDEA-003] Phase 9 — Maker & Distillery pages
- **Status:** planned
- **Category:** new
- **Seeded:** 2026-05-30
- **Last Updated:** 2026-05-30
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
- **Last Updated:** 2026-05-30
- **Priority:** P3
- **Plan:** (not yet written)
- **Summary:** A small "By the numbers" card on the You hub showing: total tastings, total pairings, favorite wrapper, favorite bourbon style, strongest vs. mildest cigars tried — derived from `tastings` + `member_saves` data already in DB. Phase 8.4 in the plan, not yet implemented.
- **Night Notes:**
  - 2026-05-30: Seeded. Mentioned in nccc-implementation-plan.md as Phase 8.4. Pure DB aggregation — no AI cost. Lower priority than maker pages; park unless P&L asks for it.
