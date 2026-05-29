# Cellar v1 — Build Plan

Agreed 2026-05-22 (Paul + Claude). Supersedes the lightweight v2 primitive sketched in `ui-refresh-v2.md` §5 — same `member_saves` table, expanded model.

## Concept

A member's Cellar is **not an inventory tracker**. It's a recommendation surface. Three independent signals per (member, product):

- **Tried** — "I've had this in my life." Sticky lifetime signal. Drives ranking.
- **Have** — "It's on my shelf / in my humidor right now." Daily-use signal.
- **Want** — "I want to try this." Wishlist.

`Have` and `Want` are mutually exclusive (you can't want what you already have). `Tried` is independent of both. Adding to `Have` auto-sets `Tried`. Removing from `Have` leaves `Tried` intact. Members can manually toggle `Tried` on/off at will — no sticky-from-tasting lock.

**No pour levels, no finished/on-hand split, no bottom-nav tab in v1.** Those are deferred Phase 5.5 additions.

## Schema

One new table.

```sql
create table member_saves (
  member_id   uuid not null references users(id) on delete cascade,
  product_id  uuid not null references products(id) on delete cascade,
  have        boolean not null default false,
  want        boolean not null default false,
  tried       boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (member_id, product_id),
  check (not (have and want))
);

create index member_saves_member_have_idx  on member_saves (member_id) where have;
create index member_saves_member_want_idx  on member_saves (member_id) where want;
create index member_saves_member_tried_idx on member_saves (member_id) where tried;
create index member_saves_product_idx      on member_saves (product_id);
```

**RLS:**
- `select`: any authenticated NCCC member (so members can browse each other's Cellars per UX-5).
- `insert / update / delete`: only `auth.uid() = member_id`.

**Trigger:** `updated_at = now()` on update.

**Rows are implicit-zero.** A missing row means all three are false. Don't insert empty rows.

## Server action

Single entry point in `lib/cellar/actions.ts`:

```ts
type CellarState = { have?: boolean; want?: boolean; tried?: boolean };

async function setCellarState(productId: string, patch: CellarState): Promise<void>
```

Behavior:
- Upserts the row, merging patch over existing state.
- Enforces mutex: if patch sets `have = true`, force `want = false`. Vice versa.
- If patch sets `have = true` and current `tried = false`, also set `tried = true` (have implies tried).
- If the resulting row is `{ have: false, want: false, tried: false }`, delete the row instead of writing zeros.
- Revalidate `/members/[memberId]`, the product detail path, and the catalog tab paths.

## Auto-derivation

Modify the existing "Recommend to NCCC" server action: on successful tasting insert, also upsert `{ tried: true }` for `(member_id, product_id)`. This is the only automatic write. Tasting deletion does NOT clear `tried` — `tried` is member-controlled, not a tasting projection.

## UI surfaces (4 places)

### 1. Product detail page — canonical
Three pill toggles below the hero, above THE CLUB SAYS:

```
[ ◯ Have ]  [ ◯ Want ]  [ ◯ Tried ]
```

Brass when active. Tapping `Have` while `Want` is on flips `Want` off (and vice versa) with a small animation. `Tried` lights independently.

### 2. Catalog cards — Feed Cigars / Bourbons tabs
A compact 3-icon control at the card's bottom-right corner. Etched-glass treatment matching the existing FOR YOU pill style. Coexists with the FOR YOU pill (top-left) and ember dot (top-right) — three corners, no overlap.

Glyphs:
- Have → small filled glass / cigar icon
- Want → bookmark
- Tried → check

Tap toggles. No long-press menu in v1.

### 3. Capture flow — after Recommend confirmation
On the reveal/confirmation screen after tapping "Recommend to NCCC", append a small section:

> **Add to your cellar?**
> [ Have on shelf ]  [ On wishlist ]

Both optional, skippable by tapping Continue. `Tried` is already implied by the recommend.

### 4. Member profile — Cellar tab
At `/members/[id]`, add a `Cellar` tab (alongside the existing Tastings). Layout:

- Three filter chips at top: `Have` / `Want` / `Tried`. Default selection: `Have`.
- Below: grid of product cards (reusing `CatalogCard` from the Feed tabs).
- Empty state per chip: Winston voice. For your own Cellar with empty `Have`: *"The shelf is bare. Add what you're pouring tonight."* For another member's empty state: *"Paul hasn't unlocked the humidor yet."*

Also add `/shelf` as a deep-link that redirects to `/members/[me]?tab=cellar`.

## Pairing engine integration

Apply a per-viewer ranking bias at read time. Do NOT mutate `pairings_cache` — the cached score is the universal club view; the bias is a viewer-specific overlay.

```ts
function applyCellarBias(baseScore: number, viewer: CellarSnapshot, cigarId, bourbonId): number {
  let bonus = 0;
  if (viewer.tried.has(cigarId))   bonus += 3;
  if (viewer.tried.has(bourbonId)) bonus += 3;
  if (viewer.have.has(cigarId))    bonus += 2;
  if (viewer.have.has(bourbonId))  bonus += 2;
  return Math.min(100, baseScore + bonus);
}
```

Max boost: 10 points on a 0–100 scale. Subtle — preserves the engine's signal while nudging toward familiar products.

Where it's applied:
- Daily Pour candidate selection (replaces or supplements the existing preference-bias step).
- Future personalized Pairings index (Tier 3 #8).

NOT applied:
- The shared `/pairings/[cigar]/[bourbon]` detail page (universal, no personalization).
- Group validation logic.

## Seed

Run `seed-cobb-whiskey.ts` as part of v1 ship. For Paul's user_id only:
- Set `have = true` (and therefore `tried = true`) on the 98 bottles.
- Idempotent — re-runs are safe.

Other members start with zero rows.

## Build order

Each step is independently testable and shippable.

1. **Migration** — `member_saves` table, RLS, indexes, trigger.
2. **`lib/cellar/`** — types, `setCellarState` server action, `getCellarSnapshot(memberId)` reader, unit tests for mutex + implied-tried logic.
3. **Auto-tried hook** — modify existing recommend action; integration test.
4. **`CellarToggle` primitive** — 3-pill component, brass active state, optimistic updates.
5. **Wire to product detail page.**
6. **Catalog-card affordance** — small icon control for Feed Cigars/Bourbons tab cards.
7. **Capture flow follow-up** — append cellar prompt to recommend confirmation.
8. **Member profile Cellar tab** — filter chips, grid, empty states.
9. **`/shelf` redirect.**
10. **Pairing bias** — `applyCellarBias` pure function, unit tests, wire into Daily Pour candidate selection.
11. **Run Paul's xlsx seed** against production.

Ship steps 1–9 together as the v1 PR. Steps 10–11 land in a follow-up PR so the bias change can be reviewed against the baseline Daily Pour.

## Tests

**Unit (lib/cellar/):**
- Mutex: setting `have=true` clears `want`, and vice versa.
- Implied tried: setting `have=true` flips `tried=true` if currently false; doesn't downgrade if already true.
- Zero-row deletion: a row going to all-false is deleted, not stored.
- `applyCellarBias` — 8 cases (each subset of {cigar tried, cigar have, bourbon tried, bourbon have}), score clamping at 100.

**Integration:**
- Recommend tasting → `tried=true` upserted.
- Mutex CHECK constraint rejects illegal direct writes (defense-in-depth).
- RLS: member A cannot write member B's rows.

**Component:**
- `CellarToggle` — tapping Want when Have is on flips Have off.

## Out of scope (deferred to full Phase 5.5)

- Pour levels (full / half / heel / empty), pour count.
- Finished vs On Hand split.
- Dedicated bottom-nav Cellar tab.
- Bulk-backfill UI ("mark everything you've had" sweep view).
- Cellar-only filter on Pairings page.
- Social counts ("5 club members have this") on product detail.
- External purchase / shop-link affordance on Want items.
- Comments or notes attached to Cellar entries.

## Open during implementation

- **Catalog-card visual density.** Three corner affordances (FOR YOU pill, ember, cellar controls) on a small card may overcrowd. If it does, collapse Cellar to a single state-aware icon and reserve full 3-pill on long-press or tap-into-detail.
- **Cellar tab card layout.** Cards currently optimize for "who recommended this" — for the `Tried` view (which can be long), a denser list mode may be needed. Decide after seeing Paul's 98-bottle render.
