# UI Refresh Plan — Phase 0.x

Captured from a UI review session on 2026-05-21. Scope: visible polish + structural fixes
to the Feed, product detail, Pairings, You, and Meetups surfaces. No new product concepts —
this is about making what we have legible, honest, and consistent with the design system.

Sequencing is suggested order, not strict. Items are independent enough to land in any
order, but typography (#1) and the FactsStrip leak (#7) should go first since they touch
everything else.

---

## 1. Typography — Bartender voice

**Problem:** Playfair italic at body-copy size on dark backgrounds is hard to read. It's
swallowing the Bartender's substance everywhere he speaks (Tonight's Pour, pairing prose,
empty states).

**Change:**
- Body prose in `<Voice />` switches from Playfair italic to a **distinctive readable
  serif, upright**. Default candidate: **Fraunces** (opinionated, soft character, legible
  at body size). Alternates if Fraunces feels wrong: Source Serif 4, EB Garamond.
- Italic retained only for sub-line garnish (e.g. photo credit overlays, one-line
  callouts).
- Playfair roman stays for product names, screen titles, and section headlines.

**Files:**
- `apps/web/src/components/primitives/Voice.tsx` (or wherever Voice lives)
- `apps/web/src/app/globals.css` — register font via `@theme`, update Tailwind font tokens
- `docs/design-system.md` — update Bartender voice rule

---

## 2. Product detail page — restructure

**Problem:** Top-level product page does too many jobs: hero, identity, club aggregate,
your tasting, full spec, radar. Layering is muddy and there's duplication.

**New top-level structure** (cigar + bourbon):
- Hero photo
- Brand + product name
- One identity line (e.g. *Lancero · medium · Nicaragua*)
- **The Club Says** — top-3 flavor notes + "and more" (see #4)
- **Your tasting block** — merged (see #5)
- Pairs With (existing, keep)
- Single CTA: **Open the depth view →** (full route)

**Depth view (new route):**
- Path: `/products/[id]/depth`
- Full construction/spec table (wrapper, binder, filler, origin, vitola, strength)
- Horizontal bar chart for flavor profile (see #3)
- **Suggest a correction →** link (see #6)

Full separate route, not a sheet — confirmed in review.

---

## 3. Flavor visualization — replace radar

**Problem:** Radar chart implies "more = better" and is hard to read.

**Change:**
- **Cigars:** horizontal bar chart. Flavor categories on Y axis, intensity on X. Thin
  brass-toned bars on dark background.
- **Bourbons:** start with horizontal bars too. Evaluate **stacked horizontal bar** once
  enriched bourbon data lands — bourbon profiles may read better as proportional segments
  (sweet/oak/spice/fruit) of a single bar. Defer the decision.
- Lives in the depth view (#2), not top-level.

---

## 4. Club Says — replace word cloud

**Problem:** Word cloud dominates the page, size encoding is hard to decode, and a member's
own words shout back at them.

**Change:**
- **With ratings present:** show top-3 flavor notes prominently in Playfair roman,
  followed by an "and more" affordance that expands to the full list.
- **Without ratings:** show the first 3 baseline notes from the catalog spec data with the
  same "and more" treatment.
- Same component, different source depending on availability.
- Kill the size-weighted cloud entirely.

---

## 5. Merge "Recommend to Club" + "You recommend this"

**Problem:** Two blocks restate the same fact. Reads like two concepts; it's one.

**Change:**
- One block. Top row: **"You recommend this · 1 of 1"** (single source of truth).
- Below: member's chips + one-liner ("one of my go tos").
- The aggregate flavor section sits separately above (Club Says) and is unambiguously the
  club's view, not yours.

---

## 6. "Not quite right?" → "Suggest a correction"

**Problem:** Copy is vague — actual intent is "the baseline spec data is wrong."

**Change:**
- Move out of top-level product page entirely.
- Lives at the bottom of the depth view (#2), near the spec table it would correct.
- Relabel: **"Spot something wrong? Suggest a correction →"**

---

## 7. FactsStrip leak fix

**Problem:** [apps/web/src/components/product/facts-strip.tsx](../apps/web/src/components/product/facts-strip.tsx) is rendering
unlabeled numeric scores as `"3 · 4 · 3"`. Cause: `body_score`, `strength_score`, and
`price_tier` aren't in the hide-key exclusion list, so they get joined with middots.

**Change:**
- Add `body_score`, `strength_score`, `price_tier` (and any sibling `*_score` numerics) to
  the hide list in FactsStrip.
- If we want these surfaced, do it in the depth view's flavor visualization with proper
  labels (e.g. *Body 3/5 · Strength 4/5*) — not in the leak.

---

## 8. Pairings page — clarify intent

**Problem:** "From your shelf" implies a Cellar feature that doesn't exist. Today's data
comes from what members have recommended in the feed.

**Change:**
- Section header → **"From your tastings"** (or *"Based on what you've recommended"*).
- No logic changes — just honest copy.
- When Cellar lands later: add **"From your cellar"** as a separate, primary section above
  tastings.

---

## 9. Capture → suggested pairing on the feed card

**Problem:** After a member recommends a cigar/bourbon, there's no natural "now try this
with…" moment. The Bartender's pairing intelligence is buried on a separate tab.

**Change:**
- The feed entry card surfaces a small Bartender-suggested pairing affordance inline.
- Restrained presentation: icon + one line, e.g. *"✦ try with Weller 12 →"*. Tap opens
  the pairing detail page.
- This is an *affordance*, not prose — does not violate the "Bartender doesn't narrate on
  feed" rule from CLAUDE.md.

**Open implementation question:** confirm the existing rules-based pairing engine supports
"given X, suggest Y" directly. If not, needs a thin wrapper.

---

## 10. You page — editable "Member since"

**Problem:** "Member since" currently reads `users.joined_at` (app signup timestamp), which
isn't the same as when the member actually joined the club (founded ~2014).

**Change:**
- Add a new nullable column: `users.club_joined_at date`.
- Display logic: prefer `club_joined_at` if set; otherwise fall back to `joined_at`
  formatted as month/year. No regression for existing members.
- Inline edit on the You page: tap "Member since June 2019" → reveals two compact selects
  (month + year). Year range: **2014 → current year**. Server Action writes
  `club_joined_at`. Month + year only — no day, no calendar picker.
- Reject future dates server-side.

**Migration:** `supabase/migrations/<timestamp>_users_club_joined_at.sql` — add nullable
column, no backfill needed.

---

## 11. Meetups — remove `/events` surface, inline on Feed

**Problem:** Separate Meetups page is more navigation than the data warrants. Two meetings
worth of context belong inline.

**Change:**
- Remove the entire `/events` surface: index page **and** `/events/[id]` detail page.
- Expand the Feed's upcoming-meetup card to show two lines:
  - **Last meeting** — small, muted/greyed, e.g. *"Last met: Apr 12 · 7 tastings"*
  - **Upcoming** — normal weight, current treatment, e.g. *"Next: May 24 at Paul's"*
- Remove any nav entry pointing to `/events`.
- `events` table stays — data still drives the inline card.

**Files:**
- Delete `apps/web/src/app/(app)/events/` directory entirely
- Update [apps/web/src/components/feed/upcoming-meetup-card.tsx](../apps/web/src/components/feed/upcoming-meetup-card.tsx)
  to fetch + render last meeting alongside next

---

## 12. Feed filter + sort — Cigars / Bourbons tabs

**Problem:** Catalog tabs have no filtering or sorting. As the catalog grows (and gets
enriched), browsing without facets becomes painful.

**UI:**
- Single thin control row beneath the tab bar, visible only on Cigars/Bourbons.
- Two affordances: **Filter** (left) + **Sort** (right). Tapping either opens a bottom
  sheet.
- Active filter count badge ("Filter (2)") and a one-line summary below the row showing
  active facets, with inline clear-all.

**Cigar filters (single-select unless noted):**
- Strength — mild, mild-medium, medium, medium-full, full (**single-select**)
- Wrapper — Connecticut, Habano, Maduro, San Andrés, Corojo, Sumatra, Cameroon, Oscuro
  (multi-select)
- Origin — country list, derived from data (multi-select)
- Club status — *Recommended by the club* (toggle)

**Bourbon filters:**
- Style — bourbon, rye, wheated, high-rye (multi-select, derived from mash_bill)
- Proof — **bands**: under 90, 90–100, 100–110, 110+ (single-select)
- Age — NAS, 4–8, 8–12, 12+ years (single-select)
- Distillery — top distilleries multi-select, long tail under "more"
- Club status — toggle

**Sort options:**
- **Most recommended** (default)
- A–Z
- Recently added to catalog
- Most tasted
- Cigar-specific: Strength light → full
- Bourbon-specific: Proof low → high, Age young → old

**State:** URL search params (`?strength=medium&sort=recommended`). Shareable,
back-nav-friendly, no client state library.

**Server-side:** filter against `specs` JSONB using Postgres `jsonb` operators. Facet
*values* derived from data (distinct query, cached) — not hardcoded — so enrichment
auto-surfaces new variants.

**Skipped:** "Things I've recommended" personal filter — not adding.

---

## 13. Dev filter — "Has data + photos"

**Problem:** During enrichment rollout we need to view only items that have real data, to
sanity-check the catalog without wading through stubs.

**Change:**
- Toggle at the top of the filter sheet, above regular facets: **"Show only enriched
  items"** (off by default).
- Gates on (strict AND): hero photo present, at least one populated spec field beyond
  name/brand, and at least one `product_reviews` row.
- Built as a real filter, not a debug flag — once the catalog is fully enriched, the
  toggle becomes effectively a no-op and can be removed (or repurposed as "Rich detail
  only" for members who want to skip thin entries).

---

## Suggested sequencing

1. Typography swap + Voice primitive (#1) — foundation, visible everywhere
2. FactsStrip leak fix (#7) — one-line bug, do it while touching the area
3. Depth view route + move spec/correction/flavor viz into it (#2, #3, #6)
4. Top-level product page restructure — Club Says top-3, merged You-recommend block
   (#4, #5)
5. Pairings header copy (#8)
6. You page — `club_joined_at` migration + editable UI (#10)
7. Meetups — remove `/events` surface, expand feed card (#11)
8. Feed filter + sort, including dev "has data" toggle (#12, #13)
9. Capture → pairing suggestion on feed card (#9) — largest unknown, may warrant a small
   sub-spec before implementation

---

## Open implementation questions

- **#9** — confirm pairing engine supports "given X, suggest Y" directly, or if a thin
  wrapper is needed.
- **#3** — once enriched bourbon data lands, decide horizontal bar vs. stacked horizontal
  bar for bourbon flavor viz.
- **#12** — confirm cigar wrapper and bourbon style values stored in specs JSONB match the
  filter facet lists, or whether we need a normalization pass during enrichment.
