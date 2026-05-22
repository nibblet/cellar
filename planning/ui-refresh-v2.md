# UI Refresh Plan — v2

Captured 2026-05-21 from a follow-up review session after v1 (`ui-refresh-plan.md`)
landed. v1 fixed typography, the depth view, member-since editing, the meetup card,
and catalog filters; this batch is mostly editorial/conceptual — re-labeling, restructuring
the pairing surface, and introducing the lightweight cellar/wishlist primitive that
the full Phase 5.5 Cellar will eventually grow on top of.

Sequencing is the suggested order. Items are independent enough to land in any
order, but the copy tweaks (#1) are 15 minutes and should go first.

---

## 1. Copy — naming what's on the table

**Problem:** Two labels on the For You hero card don't quite fit:
- "TONIGHT'S POUR" — "pour" implies bourbon-only; the card pairs a cigar + bourbon.
- "Open the pairing →" — describes the action, not the content.

**Change:**
- "TONIGHT'S POUR" → **"The Bartender's pick"** — character-led, fits either format,
  preserves the persona moment in the feed.
- "Open the pairing →" → **"Why this pairing →"** — leads with the editorial promise
  (rationale prose) instead of the mechanical action.

**Files:**
- `apps/web/src/components/feed/daily-pour-card.tsx`

---

## 2. Pairing detail — restructure into three movements

**Problem:** Current pairing detail is one prose blob from the LLM. Comparable apps
(Whiskey + Cigars) split this into narrative + reasoning + alternatives, which scans
better and lets the engine show its work without dragging the reader.

**New structure** on `/pairings/[cigarId]/[bourbonId]`:

- **Pairing notes** — the existing prose paragraph (Bartender voice)
- **Why it works** — 3-4 bullets: trait alignment, contrast, anchor flavors. Generated
  from the same LLM call as the prose, using structured output (single round trip).
- **Alternatives** — the existing "other matches" list, just relabeled and given its
  own etched divider.

**Implementation notes:**
- Bump the prose-cache LLM call to return `{ notes: string, why_bullets: string[] }`.
  Cache the structured payload in `pairings_cache.rationale_text` as JSON (or split
  into two columns — TBD during build).
- Backfill is on-demand: next render of any cached pair re-generates if it lacks
  bullets.

**Files:**
- `apps/web/src/app/(app)/pairings/[cigarId]/[bourbonId]/page.tsx`
- `apps/web/src/lib/pairing/prose-cache.ts`
- `apps/web/src/lib/openai/pairing-prose.ts` (or wherever the LLM call lives)

---

## 3. "Tasted this pairing" — one capture, two tastings

**Problem:** Right now there's no clean path to recommend a pairing as a pairing.
Members can recommend each product separately, and group-validation aggregates that
implicitly — but the gesture is split across two flows. Members who *did* enjoy them
together don't have a single moment to say so.

**Change:**
- Add a **"Tasted this pairing"** CTA on the pairing detail page (secondary button,
  below the existing primary).
- Tapping it opens the capture flow with **both products pre-filled**. Member shoots
  one photo of the pair, completes chips + recommend toggles (one set per product
  OR a shared set — decide during build), and on save we create **two linked tastings**
  with a shared `pairing_session_id` so we can render them as a single feed card
  later.
- Preserves the existing discipline: recommending still means you had the thing and
  took a photo. We're just smoothing the on-ramp for the *pairing* case.

**Deferred for now:** rendering pairing-tasting feed cards as dual/split photos. The
data lands; the special feed treatment can come in a later pass.

**Files:**
- `apps/web/src/app/(app)/pairings/[cigarId]/[bourbonId]/page.tsx` — CTA
- `apps/web/src/app/(app)/capture/` — accept `?pair=cigarId,bourbonId` query
- New migration: `tastings.pairing_session_id uuid null` (groups the two rows)

---

## 4. "The reviewers say" — surface external prose on depth view

**Problem:** We have `specs.tasting_notes_raw` populated for many enriched bourbons
(from bourbonExplorer / Apify scrapes) and it's currently hidden in `FactsStrip`'s
`HIDE_KEYS`. It's the catalog's prose voice — useful editorial context — but it
doesn't belong on the lean product face.

**Change:** On `/products/[id]/depth`, when `specs.tasting_notes_raw` is present,
render it under a small etched header **"The reviewers say"** as a single italicized
block. No CTA, no attribution UI for now (source is in `specs.review_url` if a
curious member wants to chase the link).

Cigars don't currently have an equivalent populated field. Skip until we add one.

**Files:**
- `apps/web/src/app/(app)/products/[id]/depth/page.tsx`

---

## 5. Cellar + Wishlist — the minimum-viable upkeep

**Problem:** Members will want to track what they own and what they want next. The
full Phase 5.5 Cellar (pour levels, counts, finished/on-hand) is a bigger build;
this v2 introduces the lightest model that captures both signals.

**Design decision (locked):** Single boolean per (member, product), with three
mutually-exclusive states:
- **Have** — it's in your humidor / cabinet, available.
- **Want** — on your wishlist.
- **Neither** — default.

Why no counts: counts are *more* upkeep, not less. The instant you smoke one of six
robustos, your count is wrong. A boolean = "I have these available." When you smoke
the last one, one tap turns it off. Members manage their own truth at the resolution
that matches the bottle / box, not the stick.

**Surfaces:**
- **Catalog card** — small icon top-right (next to FOR YOU pill on the opposite
  corner). Three glanceable states: empty, wishlist (bookmark), in-cellar (box icon).
- **Product detail** — two small toggles below the brass primary: *In my cellar* /
  *On my list*. Mutually exclusive.
- **You page → "Your shelf"** — new route `/shelf` with two sections (Cellar /
  Wishlist), reusing the catalog tabs' filter+sort vocabulary. Tap a row to open
  product detail. Swipe / long-press to remove (specifics TBD during build).
- **Capture flow nicety** — when logging a tasting of something marked Have, the
  save screen offers a small *"Last one — remove from cellar"* checkbox. Optional.

**Schema:**
```sql
create table member_saves (
  member_id  uuid references users(id),
  product_id uuid references products(id),
  status     text check (status in ('have', 'want')),
  created_at timestamptz default now(),
  primary key (member_id, product_id)
);
```

**Relation to Phase 5.5 Cellar:** This v2 model is the lightweight entry point.
When Phase 5.5 ships richer cellar features (pour levels, finished states, location
metadata, Paul's xlsx import), they layer onto the same `member_saves` table or
extend it — they don't replace it.

**Files:**
- `supabase/migrations/<timestamp>_member_saves.sql`
- `apps/web/src/lib/cellar/` — load/toggle/save helpers
- `apps/web/src/components/cellar/save-toggle.tsx` — the two-state icon
- `apps/web/src/components/feed/catalog-card.tsx` — render the icon overlay
- `apps/web/src/app/(app)/products/[id]/page.tsx` — render the toggles
- `apps/web/src/app/(app)/shelf/page.tsx` — new route
- `apps/web/src/app/(app)/settings/page.tsx` — link to /shelf

---

## 6. External shop link — auto-search

**Problem:** Members who like something on the catalog should be able to find it for
sale without leaving the app un-helpfully. We don't want to maintain per-product
shop URLs.

**Change:** On the product detail page (below the depth affordance), add a small
external link: **"Find at cigarpage.com →"** (or equivalent for bourbons). Construct
the URL by passing the product name as a search query to the retailer. Use an
external-link icon (↗) to signal off-app destination.

**Open question — affiliate codes:** Paul to research whether cigarpage.com / common
bourbon retailers offer affiliate referral. If yes, append the code to the search
URL.

**Files:**
- `apps/web/src/components/product/shop-link.tsx`
- `apps/web/src/app/(app)/products/[id]/page.tsx`

---

## Sequencing

1. **#1 Copy** — 15 min
2. **#2 Pairing restructure** — half day
3. **#4 The reviewers say** — 2 hours
4. **#3 Tasted this pairing** — 1 day (touches capture flow + new column)
5. **#5 Cellar + Wishlist** — 1-2 days (the centerpiece)
6. **#6 Shop link** — half day

---

## Open questions

- **#2 prose schema** — should `pairings_cache.rationale_text` stay TEXT with JSON
  inside, or split into two columns? Decide during build based on whether we'd ever
  want to surface bullets without notes (probably not → keep one column).
- **#3 chips per product or shared** — when capturing a pairing, do members log
  chips for each product separately, or share a chip set across both? Likely separate
  since the cigar and bourbon flavor wheels differ.
- **#5 swipe vs long-press to remove** — pick during build, test on iPhone.
- **#6 affiliate** — needs research from Paul. Build without first; layer in codes
  if available.
