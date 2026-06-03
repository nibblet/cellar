# Dev Plan: [IDEA-010] Availability filter chip in bourbon catalog browse

## What This Does

Adds an "Availability" filter chip to the Bourbons tab catalog browse so members can
instantly surface `everyday`, `seasonal`, `allocated`, `lottery`, or `secondary-only`
bottles. The NCCC catalog now carries `availability_rarity` on most bourbon rows (seed
pipeline populated it); IDEA-007 (now shipped) made those values visible in the browse-card
subtitle. This filter is the natural next step: once members can *see* "Allocated" on a card,
they want to *filter* to all of them.

The filter follows the same in-memory pattern already used by proof-band, style, tier, and
brand filters in `loadCatalogBrowse`. Zero AI cost. Zero DB migration.

## User Stories

- As a member, I want to filter the Bourbons catalog to "Allocated" so I can see every
  bottle worth hunting at once.
- As Paul, I want to quickly check which lottery bottles are in the catalog so I know which
  hunts to brief the group on at the next meetup.

## Implementation

### Phase 1: Types — add availability to CatalogFilters

1. Open `apps/web/src/lib/catalog/catalog-queries.ts` (or wherever `CatalogFilters` type is
   defined — search for `type CatalogFilters`).

2. Add `availability?: AvailabilityRarity | null` to the `CatalogFilters` type.

3. Import `AvailabilityRarity` from `@/lib/catalog/normalize-specs` (type import).

4. **Checkpoint:** TypeScript compile passes with the new field.

### Phase 2: Filter logic — add `passesFilters` branch

1. In the same file, find the `passesFilters` function (or equivalent guard that checks
   proof, style, tier, etc.).

2. Add an availability guard:

   ```ts
   if (filters.availability) {
     const productAvail = normalizeAvailabilityRarity(
       product.specs as Record<string, unknown> | null
     );
     if (productAvail !== filters.availability) return false;
   }
   ```

3. Import `normalizeAvailabilityRarity` from `@/lib/catalog/normalize-specs`.

4. **Checkpoint:** Filtering by availability in a unit test or manual `console.log` works.

### Phase 3: URL param — wire availability into the route

1. Open the Bourbons catalog page (likely
   `apps/web/src/app/(app)/(shell)/page.tsx` or the file that reads `searchParams`
   for the bourbons tab).

2. Read `availability` from `searchParams` and pass it to `CatalogFilters`.

3. **Checkpoint:** `?tab=bourbons&availability=allocated` narrows the list in the browser.

### Phase 4: UI — add the chip to filter controls

1. Open `apps/web/src/components/catalog/catalog-filter-controls.tsx` (or wherever the
   proof/style/tier chips are rendered).

2. Add an "Availability" chip group. Use the same `<Chip>` primitive as other filter chips.
   Labels and values:

   | Value | Label |
   |-------|-------|
   | `everyday` | Everyday |
   | `seasonal` | Seasonal |
   | `allocated` | Allocated |
   | `lottery` | Lottery |
   | `secondary-only` | Secondary |

3. Selecting a chip sets `?availability=<value>` in the URL; selecting the active chip
   again clears it (toggle pattern matching existing proof/style chips).

4. **Checkpoint:** In the browser, tapping "Allocated" filters the Bourbons list correctly
   and the chip shows as active.

### Phase 5: Polish

1. Decide chip ordering with Paul — suggested position: after Proof, before Tier. Matches
   the "how hard is this to get?" mental model.

2. Confirm "everyday" is included or excluded from the chip list. Recommendation: include
   it so members can explicitly filter to everyday pours (useful for meetup planning).

3. **Checkpoint:** Chip order looks natural on iPhone viewport. All chips are thumb-reachable.

## AI / Embedding Considerations

None. Pure client-side filter on already-loaded data.

## Design System Compliance

- No new primary actions — Brass color is not used.
- Winston is not involved.
- No flavor wheel changes.
- Filter chips use the existing `<Chip>` primitive.
- `formatMemberName` not involved.

## Mobile Constraints

- Chip strip must be horizontally scrollable at 375px. Check that adding a 5th chip group
  doesn't break the scroll affordance.
- Each chip tap target ≥ 44px.

## Database / RLS

None.

## Testing

- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] Unit test: `passesFilters` with `availability: "allocated"` excludes an everyday product
- [ ] Manual: `?tab=bourbons&availability=allocated` returns only allocated bottles
- [ ] Manual: `?tab=bourbons&availability=lottery` returns only lottery bottles
- [ ] Chip clears on re-tap (URL param removed, full list restored)
- [ ] Mobile viewport: chip strip scrollable, all chips tappable

## Dependencies

- IDEA-007 (availability in subtitle) — **done** as of 2026-06-02. Unblocked.
- FIX-017 recommended first (subtitle consistency), but not a hard dependency here.

## Estimated Total: 1–1.5 hours
