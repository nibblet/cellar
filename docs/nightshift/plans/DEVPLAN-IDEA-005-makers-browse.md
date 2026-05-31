# Dev Plan: [IDEA-005] Makers browse page

## What This Does
Completes Phase 9 maker discovery: members can browse cigar makers and bourbon distilleries from
the **Cigars / Bourbons catalog tabs** (in-tab houses view) and from a canonical **`/makers`**
index. Maker detail pages (`/makers/[slug]`) remain the destination; this work adds the front
doors.

For a club of 12 who care about provenance and house character, browsing by maker is a natural
navigation pattern alongside the existing product catalog.

## Navigation model (agreed)

| Pattern | Surface | URL |
|--------|---------|-----|
| **3b** Products \| Houses toggle | Cigars / Bourbons tab | `/?tab=cigars&view=makers` or `/?tab=bourbons&view=makers` |
| **3a** Contextual browse link | Below toggle (products view) | Same as makers view on current tab |
| **3a** Full index link | Below toggle (makers view) | `/makers?type=cigar` or `?type=bourbon` |
| **3c** Clickable bourbon dividers | Bourbons product list | `/makers/[slug]` from `makerSlugForCatalogGroup` |
| **Filter sheet** | Brand / maker section | Link to `/?tab=…&view=makers` |
| **Canonical index** | Standalone | `/makers` (both types) or scoped by `?type=` |

**Not doing:** fourth Lounge tab, For You feed grouping, bottom-nav entry.

## User Stories
- As a member, I want to browse all cigar makers and distilleries in the catalog so I can explore
  by house.
- As a member, I want to see how many products each maker has in the catalog so I know which
  houses have deep representation.
- As Winston (the club voice), I want this surface to feel like a cellar card catalog, not a
  database table.

## Implementation

### Phase 1: Data query
1. `apps/web/src/lib/makers/browse.ts`:
   - `MakerSummary`, `buildMakerSummaries` (pure, unit-tested)
   - `loadMakerSummaries(supabase, type?)` — counts from `products.brand` + `type`, metadata from `makers`
   - `makerSlugForCatalogGroup` — slug for bourbon `brand_family` dividers (prefers core-range `product.brand`)

2. **Note:** Counts use `product.brand` (maker page identity), not `brand_family`. Divider labels
   may differ from `brand`; slug resolution prefers a core-range row's `brand`.

3. **Checkpoint:** `lib/makers/browse.test.ts`

### Phase 2: Shared UI + `/makers` index
1. `components/makers/maker-summary-card.tsx`, `maker-summary-list.tsx`
2. `apps/web/src/app/(app)/(shell)/makers/page.tsx`:
   - `?type=cigar` \| `bourbon` optional filter
   - Sections: CIGAR MAKERS / DISTILLERIES
   - Links back to in-tab browse

### Phase 3: Catalog tab integration (3a, 3b, 3c)
1. `components/feed/catalog-view-toggle.tsx` — Products \| Makers / Distilleries (`view=makers`)
2. `page.tsx` — `parseCatalogView`, `CatalogBody` branches on makers vs products
3. `components/feed/brand-family-divider.tsx` — linked etched dividers on bourbon catalog
4. `catalog-filter-controls.tsx` — "Browse cigar makers" / "Browse distilleries" in filter sheet

## AI / Embedding Considerations
None — pure DB aggregation.

## Design System Compliance
- No brass on browse surfaces
- Winston: empty states only
- Etched dividers on `/makers` index sections
- `house_style`: `text-foreground-subtle` (not moss)
- Moss: not used

## Mobile Constraints
- Maker cards min 44px tap height
- Toggle segments min 44px height
- Vertical scroll only

## Database / RLS
- No migration — reads `makers` + `products`

## Testing
- [x] `lib/makers/browse.test.ts`
- [ ] `pnpm build` passes
- [ ] `pnpm test` passes
- [ ] `/?tab=cigars&view=makers` lists cigar makers
- [ ] `/?tab=bourbons&view=makers` lists distilleries
- [ ] Bourbon catalog brand dividers link to maker pages when slug resolves
- [ ] `/makers` and `/makers?type=bourbon` work
- [ ] Filter sheet browse link works

## Dependencies
- Phase 9 maker detail (`makers/[slug]/page.tsx`) — done

## Estimated Total: 2–3 hours (includes catalog-tab integration)
