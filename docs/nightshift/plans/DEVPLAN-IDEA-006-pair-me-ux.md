# Dev Plan: [IDEA-006] Pair-Me UX — Unified Capture & Suggestion Surfaces

## What This Does

Unify how members log pairings, get cross-type and same-type suggestions, and shop from the catalog around one mental model: **"I'm having X — pair me."**

Today the engines work (rules-based pairing, taste-ranked Try Next, similarity, club validation) but entry points are split (FAB = single product only; pair capture buried under Pairings tab), home-feed pour/smoke lists are weak (alphabetical Have shelf, not taste-ranked), and recommendation surfaces overlap without shared vocabulary.

This plan:

1. Puts **Both** on the Capture FAB (one photo, identify both, one-tap pair recommend).
2. Makes the **product page** the pairing hub (Try tonight / Reach for next / Hunt next).
3. Fixes **Find Your Next** pour/smoke to use the taste engine.
4. Adds **catalog shopping hints** on product detail (tier-aware similar + pairs-with) — no standalone store mode.
5. Renames surfaces to a consistent vocabulary.

Cellar boosts suggestions but is **never required**. Members who never use Cellar get full catalog fallbacks with honest copy.

## Stakeholder Decisions (locked)

| Topic | Decision |
|-------|----------|
| Pair capture | One photo identifying both pieces — keep current pairing capture flow |
| Pair recommend | "I like this combo" — one tap; individual reviews optional via product pages later |
| Flavor chips | Default: recommend saves immediately; "Add notes" expands inline (revisit if club wants more data) |
| Wrong ID | Photo primary; catalog search/select fallback on capture reveal (polish existing flows) |
| Suggestion entry | Search or capture → product page → suggestions (already mostly true; strengthen post-capture prompt) |
| Cellar vs catalog | Both, cellar first: **Try tonight** (shelf) vs **Hunt next** (catalog buy) |
| "What next" scope | Same-type (another bourbon/cigar) **and** cross-type (pair) — both on product page |
| Club signal | Club-validated pairs rank above theoretical matches |
| Store | MCP for aisle use (Claude on phone); **no** in-app store mode |
| Tier/price | Shopping suggestions tier/price aware (`suggestAdjacentProducts` with `matchTier: true`) |
| Primary action besides Capture | "I'm having X — pair me" → product page as hub |

## Product Vocabulary

Use these labels everywhere — stop overlapping names:

| Label | Meaning | Engine / source |
|-------|---------|-----------------|
| **Tonight's pick** | One rotating cigar+bourbon pair for the club/day | `loadDailyPourCandidates` + `selectDailyPour` |
| **Try tonight** | Cross-type match from Have shelf, or best catalog match if shelf empty | `suggestShelfPairing` → catalog fallback |
| **Hunt next** | Catalog buy worth pursuing for your palate | `ensureTasteRecommendations` |
| **Club tried** | Moss badge — group validated this pair | `checkGroupValidation` |
| **Pairs with** | Cross-type cigar↔bourbon | Rules engine `scorePair` |
| **Reach for next** | Same-type bourbon→bourbon or cigar→cigar | `suggestAdjacentProducts` |

Every suggestion card gets one of: **Try tonight** · **Hunt next** · **Club tried**.

## User Stories

- As a member sitting with a cigar and pour, I want to snap one photo and recommend the pair in one tap so that logging doesn't interrupt the conversation.
- As a member pouring a bourbon I already know, I want the product page to tell me what cigar to grab (from my shelf first, catalog second) so that I don't hunt through the Pairings tab.
- As a member who never uses Cellar, I want full catalog suggestions without setup walls so that the app still helps me.
- As a member browsing the catalog, I want tier-aware similar picks and a pairing hint so that I know what else to grab without opening Claude.
- As a member, I want club-validated combinations surfaced first so that the group's voice leads theoretical matches.

## Implementation

### Phase 0: Unified Suggestion Loader (foundation)

**Goal:** One pipeline every surface calls into. No new UI yet.

1. Create `apps/web/src/lib/suggestions/load-product-suggestions.ts` (name TBD — keep self-documenting).

   Export something like:

   ```ts
   export type ProductSuggestions = {
     tryTonight: CrossTypePick | null;       // shelf-first cross-type
     tryTonightCatalog: CrossTypePick | null; // catalog cross-type if no shelf hit
     reachForNext: AdjacentProduct[];          // same-type, limit 3
     huntNext: TryNextPick | null;             // taste-ranked catalog, same type
   };
   ```

2. Implementation pulls from existing modules — no new scoring math:
   - `suggestShelfPairing` + `loadOrComputeTopPairings` (cross-type)
   - `suggestAdjacentProducts` (same-type)
   - `ensureTasteRecommendations` filtered to relevant type (hunt)
   - `checkGroupValidation` — club-validated entries sort first within each list
   - `loadCellarSnapshot` — shelf badges when `have` contains candidate; silent skip when empty

3. Unit-test ranking order: club-validated > score > cellar bias.

4. **Checkpoint:** Calling the loader for any confirmed product + member ID returns structured suggestions whether or not `cellar.have` is populated.

---

### Phase 1: Unified Capture

**Goal:** FAB is the single entry for single-product and pair capture. Pair recommend is one tap.

#### 1a. Capture toggle

1. In `apps/web/src/app/(app)/(shell)/capture/capture-form.tsx`, add third option: **Both**.
2. When **Both** selected, either:
   - Embed `PairingCaptureFlow` inline, or
   - Redirect to `/pairings/capture` with shared header (prefer inline or seamless redirect — no duplicate flows).
3. Update Capture page header copy if needed: *"What are you having?"* covers all three modes.

#### 1b. One-tap pair recommend

1. In `PairingCaptureFlow` / `PairingTasteFormCollapsed`: after ID confirm, primary brass CTA **"Recommend this pairing"**.
2. Server action saves pairing session with `recommend: true`, minimal chips (empty array OK).
3. Secondary text link: *"Add tasting notes"* → existing collapsed taste form.
4. Redirect to lounge or pairing detail with `?just_saved_pairing=1` (existing param on home feed).

#### 1c. Catalog fallback polish

1. Ensure single-product capture reveal (`/products/[id]?just_captured=1`) has prominent *"Not quite right? Search catalog"* — mirror `ProductPickerSection` from pairing capture.
2. **Checkpoint:** FAB → Both → photo → confirm → Recommend → lounge in ≤4 taps after photo.

**Files likely touched:**
- `apps/web/src/app/(app)/(shell)/capture/capture-form.tsx`
- `apps/web/src/app/(app)/(shell)/capture/page.tsx`
- `apps/web/src/components/pairing/pairing-capture-flow.tsx`
- `apps/web/src/components/pairing/pairing-taste-form-collapsed.tsx`
- `apps/web/src/app/(app)/(shell)/pairings/capture/actions.ts`

---

### Phase 2: Product Page as Pairing Hub

**Goal:** Search bourbon → product page → Try tonight + Reach for next + Hunt next.

#### 2a. Winston Suggests block

1. Create `apps/web/src/components/product/winston-suggests.tsx` (or extend product detail sections).
2. Replace separate **Pairs With** + **You might also like** sections with structured block:

   ```
   ── WINSTON SUGGESTS ──

   Try tonight          [cross-type; shelf badge if on Have]
   ● Club tried         [moss if validated]

   Reach for next       [same-type horizontal scroll, 2–3]

   Hunt next            [1 taste-ranked catalog pick, same type]
   ```

3. Product detail page calls Phase 0 loader instead of ad-hoc parallel fetches.

#### 2b. Layout when on Have shelf

1. If product is in member's `have`, move Winston Suggests above flavor tag cloud (still below THE CLUB SAYS).
2. Top cross-type card gets *"On your shelf"* / *"In your humidor"* badge.

#### 2c. Post-capture prompt

1. When `?just_captured=1`, render inline banner above Winston Suggests:
   - Winston: *"Pouring this now? Here's what to grab."*
   - Top `tryTonight` card + brass **"See the pairing"** → `/pairings/[cigarId]/[bourbonId]`
2. No persistent dismiss state needed — disappears on next visit without query param.

**Files likely touched:**
- `apps/web/src/app/(app)/(shell)/products/[id]/page.tsx`
- `apps/web/src/components/product/winston-suggests.tsx` (new)
- `apps/web/src/components/pairing/pairs-with.tsx` (may become internal to winston-suggests)
- `apps/web/src/components/product/you-might-also-like.tsx` (may fold in)

**Design system:**
- One brass primary per screen: post-capture **See the pairing** OR existing Recommend segment — not both competing. Prefer keeping Recommend segment as primary on just-captured; pairing prompt uses secondary/link styling.
- Moss only for club-validated markers.
- Etched `<Divider label="Winston suggests" />` at section break.

**Checkpoint:** Open any bourbon → see cross-type + same-type + hunt; works with zero Cellar usage.

---

### Phase 3: Home Feed — Fix Find Your Next

**Goal:** Pour/smoke lists use taste engine; rename modes; cellar-optional copy.

1. Rewire `apps/web/src/lib/find-next/load.ts` `loadProductSuggestions()`:
   - **Cellar path:** rank Have-shelf products by taste similarity (not alphabetical).
   - **Catalog path:** reuse `ensureTasteRecommendations` picks for the type.
   - Merge with existing `mergeProductSuggestions` cellar-first logic.

2. Rename in `apps/web/src/components/feed/find-your-next-hero.tsx`:

   | Old mode | New label |
   |----------|-----------|
   | `pairing` | **From your shelf** |
   | `pour` | **Reach for a pour** |
   | `smoke` | **Reach for a smoke** |

   Section header: **What to reach for** (replaces "Find your next").

3. Each list item shows **Try tonight** or **Hunt next** badge per Phase 0 vocabulary.

4. Empty cellar copy: *"Mark bottles you own to see shelf picks — until then, here's what fits your palate from the catalog."*

**Files likely touched:**
- `apps/web/src/lib/find-next/load.ts`
- `apps/web/src/lib/find-next/types.ts` (optional badge field)
- `apps/web/src/components/feed/find-your-next-hero.tsx`

**Checkpoint:** Member with zero Cellar usage sees 5 meaningful pour/smoke suggestions on home feed.

---

### Phase 4: Catalog Shopping Layer (no store mode)

**Goal:** Tier-aware similar + pairs-with when browsing catalog → product detail.

1. On product detail, add **"While you're looking"** subsection (below Hunt next, or folded into Winston Suggests when referrer is catalog tab — optional v1: always show):

   - **Similar in this tier** — `suggestAdjacentProducts({ matchTier: true, limit: 3 })`
   - **Pairs well with** — top cross-type catalog match
   - Subtitle shows tier/price: *"Tier 3 · ~$45"* from `specs.tier` / `specs.price_usd`

2. Optional v2: catalog card secondary line for warm taste signal — *"Similar to bourbons you've loved"* — defer if scope tight.

3. Update `docs/nccc-mcp-setup.md` with member prompt pattern:

   > *"I'm looking at [name]. Similar options in the same tier, and a cigar to pair."*

4. **Explicitly not building:** standalone store mode, aisle scanner, Lowe's-style UI.

**Checkpoint:** Browse Cigars/Bourbons tab → open product → see tier-aware similar + pair without Claude.

---

### Phase 5: Surface Rename Pass

Copy-only sweep after Phases 1–4 ship:

| Old | New |
|-----|-----|
| Daily Pour card | **Tonight's pick** |
| Find your next (section) | **What to reach for** |
| Try Next (cellar) | **Worth hunting** |
| Pairings tab subtitle | **Your matches** |
| Pairings → Capture a pairing | **Log a pairing** (secondary to FAB Both) |

**Files likely touched:**
- `apps/web/src/components/feed/daily-pour-card.tsx`
- `apps/web/src/app/(app)/(shell)/pairings/page.tsx`
- `apps/web/src/components/cellar/try-next.tsx`
- `apps/web/src/app/(app)/(shell)/you/cellar/page.tsx`

---

### Phase 6: Tier 4 Enhancements (backlog)

Build after Phases 0–4. Order by lift:

1. **"Add to tonight"** — pairing detail one-tap log to feed without full taste form (spec §4.3).
2. **Vitola + trait fallback** — when top pairing score < 60, similarity match in common vitola (roadmap §20b).
3. **Co-tasted adjacent picks** — "Members who tried X also loved Y" from tasting overlap (roadmap §21).
4. **Pairing detail one-tap recommend** — align with Phase 1 pair capture pattern on `/pairings/[cigarId]/[bourbonId]`.

---

## Implementation Order

```
Phase 0 (loader) ──┬──► Phase 1 (unified capture)
                   ├──► Phase 2 (product hub)
                   └──► Phase 3 (home feed)
                              │
                   Phase 2 ──┴──► Phase 4 (catalog shopping)
Phase 1 + 2 ────────────────► Phase 5 (rename pass)
Phase 2 ─────────────────────► Phase 6 (backlog)
```

**Suggested sprints:**
- **Sprint A:** Phase 0 + 1
- **Sprint B:** Phase 2 + 3
- **Sprint C:** Phase 4 + 5
- **Backlog:** Phase 6

## AI / Embedding Considerations

- Phase 0–5 reuse existing engines — no new LLM calls for core flows.
- Hunt next rationales already generated by `generateRationales` in taste module (cached on user profile).
- Pairing prose (`ensurePairingProse`) unchanged — still on pairing detail page only.
- Cost impact: negligible for Phases 0–3; Phase 4 adds no new generation.

## Design System Compliance

- **Brass:** one primary action per screen. Capture recommend, post-capture pairing link uses secondary/ghost where Recommend segment is already brass.
- **Moss:** club-validated pairing markers only.
- **Ember:** recommend icons on feed — unchanged.
- **Winston `<Voice />`:** post-capture prompt on product detail is permitted (recommendation intro context). Not on raw capture viewfinder or feed chronological list.
- **Etched dividers:** Winston suggests, Tonight's pick, Worth hunting — every major break.
- **Identity:** `formatMemberName` wherever member names appear in club-validated copy.

## Mobile Constraints

- One-handed iPhone: FAB Both flow ≤4 taps after photo to saved pair.
- Product page Winston block: Try tonight card thumb-reachable; Reach for next horizontal scroll.
- Find Your Next sheet: existing bottom sheet pattern, no new client complexity beyond badge labels.

## Database / RLS

- No new tables or migrations for Phases 0–5.
- Taste recommendations cache already on `users.taste_recommendations` (migration `20260528000002`).
- Pairing sessions, tastings, member_saves — existing RLS unchanged.

## Testing

- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes on changed files
- [ ] `lib/suggestions/` unit tests: ranking order (club-validated first, cellar bias, empty cellar fallback)
- [ ] FAB → Both → photo → one-tap recommend → lounge (< 30s chair test)
- [ ] Product page: cross-type + same-type + hunt with zero Cellar rows
- [ ] Product page: shelf badges when Have populated
- [ ] Home feed pour/smoke: taste-ranked, not alphabetical
- [ ] Club-validated pair appears above higher-scoring theoretical match
- [ ] Catalog browse → product → tier-aware similar visible
- [ ] MCP `recommend` + `suggest_similar` unchanged (regression)

## Success Criteria

1. **Chair test:** FAB → Both → photo → recommend pair → lounge in under 30 seconds.
2. **Pair-me test:** Search bourbon → product page → Try tonight + Reach for next + Hunt next without visiting Cellar.
3. **Non-cellar member:** Same flow works; no dead ends or "set up your cellar" walls.
4. **Store test (MCP):** *"I'm looking at Buffalo Trace"* → similar tier-aware bourbons + cigar pairing via existing tools.
5. **Club signal:** Suggestion lists show moss **Club tried** entries before theoretical matches.

## Dependencies

| Module | Status |
|--------|--------|
| `lib/pairing/engine.ts` — `suggestPairings`, `suggestShelfPairing` | Exists |
| `lib/taste/load.ts` — `ensureTasteRecommendations` | Exists |
| `lib/similarity/suggest-adjacent.ts` | Exists |
| `lib/pairing/group-validation.ts` | Exists |
| `lib/find-next/load.ts` | Exists — needs rewire in Phase 3 |
| `components/pairing/pairing-capture-flow.tsx` | Exists |
| MCP tools in `lib/mcp/tools.ts` | Exists — docs update only in Phase 4 |

## Open Decisions

| Question | Recommendation |
|----------|----------------|
| Home hero when not holding a specific product | Keep **Tonight's pick** as passive daily pair; **What to reach for** below for browsing. "I'm having X" stays product-page-first. |
| Pairings tab future | Becomes history + club-validated gallery; not primary capture once FAB has Both. |
| Flavor chips default | Ship Phase 1 with empty chips OK; revisit if club wants richer flavor data. |

## Estimated Total

- Phase 0: 2–3 hours
- Phase 1: 3–4 hours
- Phase 2: 4–6 hours
- Phase 3: 2–3 hours
- Phase 4: 2–3 hours
- Phase 5: 1 hour
- **Phases 0–5 total: ~2–3 days**
- Phase 6: backlog, sized per item
