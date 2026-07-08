# Evening Model — Full UI Remix

**Status:** Approved in chat 2026-07-07 (Paul). Supersedes conflicting sections of `2026-07-03-personal-ia-reshuffle-design.md`.
**Author:** Paul + Cursor (brainstorming session).

---

## Why this exists

The Cellar fork inherited NCCC's five-tab shell: **Cellar · Catalog · Capture · Pairings · You**. That layout optimizes for club browse and pairing archives. For a solo member, the valuable spine is already on the home page — Tonight's pick, Palate bar, Try next, Hunt next — but navigation still treats Catalog and Pairings as peers, buries the collection on You, and serves a 500-row catalog grid with full-size images.

This spec defines a **full remix** of information architecture plus **catalog performance** and **freshness mechanics**, without rebuilding the pairing engine, taste vectors, or cellar data model.

---

## Core decision

### One question per primary tab

| Tab | Question it answers | Route |
|---|---|---|
| **Cellar** (home) | What should I do tonight? | `/` |
| **Shelf** | What do I own, want, and have tried? | `/shelf` |
| **Log** | What have I captured? | `/log` |
| **You** | Who am I here, and how do I browse deeper? | `/you` |
| **Capture** (FAB) | Log something now | `/capture` |

**Catalog** and **Pairings detail** are secondary — reachable from You, Hunt next, Tonight's pick, and product pages. They do not earn primary nav slots.

This **keeps `/` as the concierge home** (the page Paul liked). It **does not** move guidance to `/you` (which the July 2026 reshuffle proposed).

---

## Navigation model

### Bottom nav (5 slots, unchanged geometry)

```
Cellar  ·  Shelf  ·  [Capture]  ·  Log  ·  You
```

- Remove **Catalog** and **Pairings** from bottom nav.
- **Capture** remains the brass FAB (center).
- **Settings** stays off primary nav; linked from You.

### Canonical paths

| Constant | Path | Role |
|---|---|---|
| `TONIGHT_PATH` / `CELLAR_HOME_PATH` | `/` | Concierge home (Tonight's pick, Palate bar, Try next, Hunt next) |
| `SHELF_PATH` | `/shelf` | Have / Want / Tried collection |
| `LOG_PATH` | `/log` | Unified tasting + pairing timeline |
| `APP_HOME_PATH` | `/you` | Taste profile + secondary browse entry |
| `CATALOG_PATH` | `/catalog` | Reference index (secondary) |
| `SETTINGS_PATH` | `/settings` | Preferences, identity, account |
| `PAIRINGS_DETAIL` | `/pairings/[cigarId]/[bourbonId]` | Pairing view mode (unchanged) |

### Redirects

| Legacy route | Redirect |
|---|---|
| `/pairings` | `/log?filter=pairings` |
| `/you/pairings` | `/log?filter=pairings` |
| `/you/tastings` | `/log?filter=tastings` |
| `/you/cellar` | `/shelf` |
| `/cellar` | `/shelf` (if route exists) |

Post-auth entry (`login`, onboarding `lounge` exit) lands on **`/`** (Cellar home), not `/you`.

---

## Page specifications

### `/` — Cellar (concierge home)

**Job:** *What should I pour, smoke, or chase tonight?*

Keep the existing home stack (`CellarHomeClient` + `home-v2-sections`). Rename only where clarity helps:

| Section | Change |
|---|---|
| Header | Keep **The Cellar** title; optional subtitle "Tonight" in meta line |
| Tonight's pick | Add **shuffle** control (reuse `selectPickPour` + `rollIndex` from `PickPourButton`) |
| Palate bar | No change |
| Try next | Add daily rotation + pairing hint chips (see Freshness) |
| Hunt next | Split into **For you** / **Fresh drops** sub-lanes (see Freshness) |

Winston appears here per design system (recommendation surfaces).

**Does not belong here:** Have/Want/Tried inventory UI, settings, archive lists.

---

### `/shelf` — collection

**Job:** *What do I have, what do I want, what have I tried?*

Promote `CellarSection` to a dedicated primary tab. Remove it from `/you`.

Contents:
- Have / Want / Tried segmentation (existing `CellarTab`)
- Wishlist ranking (existing `rankWants`)
- Search/filter within shelf (reuse catalog filter vocabulary where applicable)
- Stat strip at top: bottles, cigars, hunting count (reuse `CellarStatStrip`)

Winston: empty states only.

**Header:** "Your shelf" (supporting copy may say humidor/cabinet; route label stays **Shelf**).

---

### `/log` — unified capture history

**Job:** *What have I done?*

Merge tastings and pairings into one reverse-chronological timeline.

**Entry types:**

1. **Tasting entry** — single product, photo thumb, date, link to product
2. **Pairing entry** — dual-product visual card (reuse `TonightsPickCard` / `CircleBadge` vocabulary at list scale), Winston quote snippet when cached, link to pairing detail

**Filters** (URL search params):

- `filter=all` (default)
- `filter=tastings`
- `filter=pairings`

**Empty state:** Winston line + brass link to Capture.

Pairing list cards upgrade from text-only `PairingSessionCard` to visual `PairingLogCard` (new component).

---

### `/you` — taste profile

**Job:** *How is my palate evolving, and where do I go deeper?*

Rewrite `/you` away from archive launcher toward a **living portrait**:

1. **Hero** — greeting + stat strip (bottles / cigars / hunts / tastings this month)
2. **Palate insight** — `loadCachedInsight` teaser with link to settings preferences
3. **Last session highlight** — one visual card (most recent pairing or tasting)
4. **Browse** — links to Catalog (search icon treatment), Makers, Settings
5. **Optional milestones** — pairing count, first allocated hunt (secondary, collapsible)

Remove from `/you`:
- Full `CellarSection` (moves to `/shelf`)
- Duplicate PersonalCard archive grid (Log tab owns archives)

Winston: insight + empty milestones only.

---

### `/catalog` — reference index (secondary)

**Job:** *Look something up.*

Demoted from primary nav. Entry points:
- You → "Browse catalog"
- Hunt next card → product → depth
- Header search on Cellar home (optional phase-2 affordance)

**Performance requirements (mandatory in this remix):**

| Issue | Fix |
|---|---|
| Loads 500 rows + signs all hero paths | Paginate: **36 rows** initial server render |
| Full-resolution images in grid | Sign **thumbnail** paths (400px wide transform or stored thumb) |
| No lazy loading | `loading="lazy"` on below-fold images; intersection observer for infinite scroll |
| Heavy default view | **Makers/brands** as default when no search query; products grid when searching |

Target: first contentful paint under 2s on LTE for unfiltered cigars tab.

---

## Pairings after remix

Pairings are a **layer**, not a destination.

| Surface | Pairing behavior |
|---|---|
| Tonight's pick | Hero CTA → pairing detail |
| Try next product card | "Pairs with …" chip → pairing detail |
| Post-capture | "Try this pairing?" when both types present |
| Log | Visual pairing entries → pairing detail |
| Product detail | Existing `PairsWith` / suggestions |

Remove `/pairings` from nav. Index redirects to `/log?filter=pairings`.

Pairing **detail** page (`/pairings/[cigarId]/[bourbonId]`) unchanged structurally; may gain richer product imagery on header.

---

## Freshness mechanics

Static rails are the top complaint. These rules use existing loaders; no new ML.

### Tonight's pick

- Daily seed: `selectPickPour({ memberId, date, rollIndex: 0 })` (existing)
- **Shuffle button** increments `rollIndex`; server action or client state + refresh
- Exclude last **3** served pairs from candidate pool (store in `users` JSON column or derive from recent pairing sessions)

### Try next

- Rank by cosine similarity (existing), then **daily shuffle within top 8** per type using `fnv1a32(memberId|date|type)`
- **Deprioritize** products tasted in last 14 days
- Show **"Pairs with [name]"** — best cellar match of opposite type via `suggestPairings` or existing pairing engine
- Optional badge: "Haven't had since …"

### Hunt next

Two sub-lanes in the rail (tabs or stacked sections):

| Lane | Source | Mix |
|---|---|---|
| **For your palate** | Cached `taste_recommendations` (existing) | 60% |
| **Fresh drops** | Catalog products with `created_at` or enrichment date in last 60 days, filtered by tier + preferences | 25% |
| **Stretch picks** | `suggestAdjacent` from recent loved tastings | 15% |

**News/releases (phase 2):** Curated JSON feed (`data/releases.json`) keyed by brand; surfaced as "In the wild" cards inside Fresh drops. No live news API in v1.

Invalidate hunt cache when: tried/loved changes, preferences change, or calendar week rolls (add week number to display seed, not DB cache key).

---

## Design-system constraints

- **Brass** = one primary action per screen (Capture FAB globally; section CTAs on home).
- **Ember** = loved / lit recommend signal only.
- **Moss** = on-your-shelf indicator on suggestions.
- **Etched dividers** at major section breaks on Shelf, Log, You.
- **Winston** (`<Voice />`): recommendation surfaces, empty states, Log empty — not on Shelf inventory rows.
- No star ratings, sliders, or public-social framing.

This is a **reorganization + performance + freshness** pass, not a visual rebrand.

---

## Relationship to prior specs

| Prior doc | Disposition |
|---|---|
| `2026-07-03-personal-ia-reshuffle-design.md` | **Superseded** where it makes `/you` the front door or moves concierge off `/` |
| `2026-07-03-personal-ia-reshuffle.md` plan | **Do not execute** as written; use this spec's plan instead |
| `planning/ui-refresh-v2.md` | Pairing restructure (why bullets) already landed; visual Log cards extend §2 |
| `planning/cellar-v1-plan.md` | Cellar data model unchanged |

---

## Phased delivery

| Phase | Scope | Outcome |
|---|---|---|
| **1** | Nav + routes + redirects | New tab shell, Shelf page, Log skeleton |
| **2** | Shelf + You rewrite | Collection and profile match new jobs |
| **3** | Log visuals | Merged timeline + `PairingLogCard` |
| **4** | Catalog performance | Pagination, thumbs, lazy load, makers default |
| **5** | Freshness | Shuffle, rotation, hunt lanes, pairing hints |
| **6** | Onboarding sweep | Welcome flow NAV_MAP matches new tabs |

Each phase ships usable software. Phases 1–3 are IA; 4 is performance; 5 is delight.

---

## Risks

- **Naming:** "Cellar" tab = home concierge; "Shelf" tab = inventory. Support copy must not conflate them.
- **Log merge complexity:** Tastings and pairings have different row shapes; timeline sort key is `created_at` with stable tie-break.
- **Catalog pagination + filters:** URL params must preserve filter state across pages (`?page=2&strength=medium`).
- **Fresh drops data:** Many products lack `created_at` granularity; fall back to enrichment timestamp in `specs`.

---

## Success criteria

1. Primary nav has exactly: Cellar, Shelf, Capture, Log, You.
2. `/` loads Tonight's pick + rails without inventory UI.
3. `/shelf` is the only place for Have/Want/Tried management.
4. `/log` shows both tastings and pairings; `/pairings` redirects there.
5. Catalog first paint loads ≤36 cards with thumbnail images.
6. Try next visibly changes day-over-day without a taste-profile change.
7. Hunt next shows at least two distinct lanes when catalog data allows.

---

## Open questions (locked at implementation)

- **Search on Cellar home:** Phase 1 uses You → Catalog link; header search icon is phase 2 if timeboxed.
- **Releases feed:** Ship `data/releases.json` stub in phase 5 or defer to phase 6.
- **Shuffle persistence:** Tonight's pick shuffle resets daily; rollIndex stored client-side only (matches `PickPourButton`).
