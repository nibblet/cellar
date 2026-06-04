# Dev Plan: [IDEA-013] Club recommendation count badge on catalog cards

## What This Does
When members browse the Bourbons or Cigars catalog tab, there's no visible signal for how many club members have recommended a given product. The sort order defaults to "recommended" (most club recs first), but once scrolled past the top, every card looks equally anonymous. 

Surfacing a "club recs" indicator (e.g., "3 club recs") directly on the card gives members a quick quality signal when scrolling — especially useful when filtering by availability or style. The data already exists (`rec_count` is computed per product in `loadCatalogBrowse`), but it's stripped from `CatalogEntry` before the card receives it. This plan threads it through to the card.

## User Stories
- As a member, I want to see at a glance how popular a bourbon is with the club so I can prioritize what to try next without tapping into each product detail.
- As a member browsing the "Allocated" filter, I want to know which rare bottles the club actually endorses so I don't hunt something the group hasn't validated.

## Implementation

### Phase 1: Add `rec_count` to `CatalogEntry`

1. Open `apps/web/src/lib/feed/catalog-queries.ts`

2. In the `CatalogEntry` type, add the field:
   ```ts
   rec_count: number;
   ```

3. In the final `entries.map(...)` strip call, preserve `_rec_count` instead of discarding it:

   Before:
   ```ts
   return entries.map(
     ({ _rec_count: _r, _tasting_count: _t, _created_at: _c, _specs: _s, ...e }) => e,
   );
   ```

   After:
   ```ts
   return entries.map(
     ({ _rec_count, _tasting_count: _t, _created_at: _c, _specs: _s, ...e }) => ({
       ...e,
       rec_count: _rec_count,
     }),
   );
   ```

4. **Checkpoint:** Run `pnpm typecheck` from `apps/web/`. TypeScript should complain that `CatalogCard` doesn't use `rec_count` yet (it will be an unused field — that's fine until Phase 2).

### Phase 2: Render the badge on `CatalogCard`

1. Open `apps/web/src/components/feed/catalog-card.tsx`

2. Render a club-recs badge on cards with `entry.rec_count >= 2`. Place it just below the subtitle (inside the metadata strip, not as a photo overlay — keeps the card clean and legible):

   After the `{entry.subtitle ? ...}` block, add:
   ```tsx
   {entry.rec_count >= 2 ? (
     <p className="text-[10px] uppercase tracking-widest text-foreground-subtle mt-0.5">
       {entry.rec_count} club rec{entry.rec_count === 1 ? "" : "s"}
     </p>
   ) : null}
   ```

3. **Checkpoint:** Start `pnpm dev` and browse to the Bourbons tab. Cards with 2+ recommendations should show the count. Sort by "recommended" to confirm the count correlates with order. Cards with 0–1 recs should show nothing (no noise for un-tasted catalog items).

### Phase 3: Update tests

1. Open `apps/web/src/lib/feed/catalog-queries.test.ts`

2. Add assertions confirming `rec_count` is present in the returned `CatalogEntry` objects and that the value matches the expected count from mock tasting data.

3. **Checkpoint:** Run `pnpm test` from `apps/web/`. All existing tests pass plus the new assertion.

## AI / Embedding Considerations
None. This is pure DB aggregation already done in the existing query.

## Design System Compliance
- No brass elements added (no primary action)
- Text in `text-foreground-subtle` — neutral, not misleading
- No Winston voice (catalog list context — Winston doesn't appear here per convention)
- No new dividers needed
- `formatMemberName` not relevant (no member names)

## Mobile Constraints
- The badge is text-only in the existing metadata strip — no tap target added
- One line of 10px text; fits within existing card height; no layout shift
- The card already handles multi-line subtitle gracefully; this follows the same pattern

## Database / RLS
No migration needed. `rec_count` is computed from `tastings` in-process during `loadCatalogBrowse`. No schema change.

## Testing
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (new assertion in catalog-queries.test.ts)
- [ ] Browse Bourbons tab: cards with multiple recs show "N club recs" below subtitle
- [ ] Cards with 0 or 1 rec show nothing (threshold `>= 2`)
- [ ] Sort by "Recommended" — badge count correlates with sort order
- [ ] Availability filter: "Allocated" cards that have recs show the count correctly

## Dependencies
None. All data already computed in `loadCatalogBrowse`.

## Estimated Total: 45 minutes
