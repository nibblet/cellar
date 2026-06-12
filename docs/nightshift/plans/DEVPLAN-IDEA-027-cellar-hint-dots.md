# Dev Plan: [IDEA-027] Cellar Hint Dots on WinstonSuggests Cards

## What This Does

`WinstonSuggests` renders four suggestion sections on product detail: "Reach for Next"
(horizontal scroll), "Hunt Next" (TryNextPick rationale), "Similar in Tier," and "Pairs
Well With." These cards show product name and subtitle but give no indication of the
member's existing cellar relationship — whether they already Have it, Want it, or have
Tried it. A member must navigate into each card to discover they already own it.

This adds small read-only indicator dots (Have / Want / Tried) to suggestion cards. The
cellar snapshot is already computed inside `loadProductSuggestions`; this plan surfaces
it to the component boundary with no new DB queries. The `loved` flag is excluded from
dots (it's a private "stronger than tried" signal, never club-facing per conventions).

## User Stories

- As a member scanning "Reach for Next" suggestions, I want to see at a glance which
  bottles I already have or have tried, so I don't click into products I've already
  evaluated.
- As a member browsing "Hunt Next," I want to know if I've already tried the recommended
  bottle, so Winston's rationale lands with context.

## Architecture (confirmed by nightshift 2026-06-12 scan)

`loadProductSuggestions(supabase, productId, memberId)` calls `loadCellarSnapshot`
internally (line ~180 of `load-product-suggestions.ts`) and uses it to populate
`onShelf` booleans on each suggestion item — but strips the snapshot before returning.
The product detail page calls `loadProductSuggestions` and passes the result to
`WinstonSuggests` as `suggestions`. There is no `cellarSnapshot` prop on
`WinstonSuggests`.

**Fix:** Extend `loadProductSuggestions` to return `{ suggestions, cellarSnapshot }` —
reusing the snapshot already fetched, with zero new DB queries. Update the page and
component to thread it through.

All suggestion items already expose `product_id` (`ReachForNextPick`, `AdjacentProduct`,
`TryNextPick`) or `cigar_id`/`bourbon_id` (`CrossTypePick`) — lookups against the
snapshot Set are O(1).

## Implementation

### Phase 1: Return snapshot from `loadProductSuggestions`

1. Open `apps/web/src/lib/suggestions/load-product-suggestions.ts`.
2. Change the return type from `ProductSuggestions | null` to
   `{ suggestions: ProductSuggestions; cellarSnapshot: CellarSnapshot | null } | null`.
3. At the end of the function body, replace `return suggestions;` with:
   ```ts
   return { suggestions, cellarSnapshot: cellar ?? null };
   ```
   where `cellar` is the snapshot variable already in scope (line ~180).
4. Add `import type { CellarSnapshot } from "@/lib/cellar/types";` at the top (type
   import only).
5. **Checkpoint:** TypeScript should now error at the call site in page.tsx — that's
   expected; fix next.

### Phase 2: Thread snapshot through to WinstonSuggests

1. Open `apps/web/src/app/(app)/(shell)/products/[id]/page.tsx`.
2. The `loadProductSuggestions` call is at lines ~89–90. Update destructure:
   ```ts
   // Before:
   loadProductSuggestions(supabase, id, userId ?? null),
   // After (assign to a temp name, then destructure):
   loadProductSuggestions(supabase, id, userId ?? null),
   ```
   More precisely, find the `await Promise.all([...])` block. Change the assignment
   from `const suggestions = await loadProductSuggestions(...)` to:
   ```ts
   const suggestionResult = await loadProductSuggestions(supabase, id, userId ?? null);
   const suggestions = suggestionResult?.suggestions ?? null;
   const suggestionCellarSnapshot = suggestionResult?.cellarSnapshot ?? null;
   ```
   (If the call is inside `Promise.all`, extract the result similarly.)
3. Pass `cellarSnapshot={suggestionCellarSnapshot}` to `<WinstonSuggests>`.
4. Add `cellarSnapshot?: CellarSnapshot | null` to `WinstonSuggestsProps` in
   `apps/web/src/components/product/winston-suggests.tsx`.
   - Add `import type { CellarSnapshot } from "@/lib/cellar/types";` (type import).
5. **Checkpoint:** `pnpm build` should pass (no new errors introduced, the new prop is
   optional).

### Phase 3: Create `CellarStatusDots` read-only component

1. Create `apps/web/src/components/cellar/cellar-status-dots.tsx`:
   ```tsx
   "use client";

   import type { CellarRow } from "@/lib/cellar/types";

   type Props = {
     state: Pick<CellarRow, "have" | "want" | "tried">;
   };

   export function CellarStatusDots({ state }: Props) {
     const dots: { label: string; active: boolean }[] = [
       { label: "Have", active: state.have },
       { label: "Want", active: state.want },
       { label: "Tried", active: state.tried },
     ];
     const activeDots = dots.filter((d) => d.active);
     if (activeDots.length === 0) return null;
     return (
       <div className="flex items-center gap-1" aria-label="Your cellar status">
         {activeDots.map((d) => (
           <span
             key={d.label}
             className="rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] font-medium text-foreground-subtle leading-none"
             aria-label={d.label}
           >
             {d.label}
           </span>
         ))}
       </div>
     );
   }
   ```
2. Add the export to `apps/web/src/components/cellar/index.ts` (barrel export).
3. **Checkpoint:** Component renders inline with zero actions and no client state beyond
   props.

### Phase 4: Integrate dots into WinstonSuggests card renders

Open `apps/web/src/components/product/winston-suggests.tsx`.

For each suggestion section below, add `<CellarStatusDots>` immediately below the
product name / subtitle line inside the card. Import `CellarStatusDots` from
`@/components/cellar`.

Helper inline (add near the top of the component function):
```ts
function cellarRowFor(
  productId: string,
  snap: CellarSnapshot | null | undefined,
): Pick<CellarRow, "have" | "want" | "tried"> {
  if (!snap) return { have: false, want: false, tried: false };
  return {
    have: snap.have.has(productId),
    want: snap.want.has(productId),
    tried: snap.tried.has(productId),
  };
}
```

**Reach for Next** (`reachForNext` section): each `ReachForNextPick` has `product_id`.
```tsx
<CellarStatusDots state={cellarRowFor(p.product_id, cellarSnapshot)} />
```

**Hunt Next** (`huntNext`): `TryNextPick` has `product_id`.
```tsx
<CellarStatusDots state={cellarRowFor(huntNext.product_id, cellarSnapshot)} />
```

**Similar in Tier** (`whileLooking.similarInTier`): each `AdjacentProduct` has
`product_id`.
```tsx
<CellarStatusDots state={cellarRowFor(p.product_id, cellarSnapshot)} />
```

**Pairs Well With** (`whileLooking.pairsWellWith`): `CrossTypePick` has `cigar_id` and
`bourbon_id`. The *other* product (not the source) is what the member would cellar.
Determine which ID is the opposite type from `sourceType`:
```ts
const pairProductId =
  sourceType === "cigar"
    ? whileLooking.pairsWellWith.bourbon_id
    : whileLooking.pairsWellWith.cigar_id;
```
Then: `<CellarStatusDots state={cellarRowFor(pairProductId, cellarSnapshot)} />`

5. **Checkpoint:** On product detail for a product where the member has some shelf items,
   the suggestion cards for those products should now show tiny inline dots.

## AI / Embedding Considerations

None. This is pure server-side data threading + static client render. No new AI calls,
no new DB queries.

## Design System Compliance

- No brass element added (these are read-only status indicators, not CTAs).
- No Winston voice added.
- No moss color used (these are cellar-status dots, not club-validation signals).
- No sliders or wheel renders.
- `formatMemberName` is not applicable (no member names rendered).
- Dots are styled with `bg-foreground/10 text-foreground-subtle` — neutral palette.

## Mobile Constraints

- Dots are 10px text, `px-1.5 py-0.5` — minimum 24px tap target not required here
  because these are read-only indicators, not interactive buttons.
- Horizontal scroll sections ("Reach for Next") render within the existing card width;
  the dots sit below the subtitle and add ~16px vertical height per card.
- No layout changes to the outer scroll container.

## Database / RLS

None. Uses existing `member_saves` data already in-memory via the snapshot loaded by
`loadProductSuggestions`.

## Testing

- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` for `lib/` (no lib changes expected; snapshot return type change
  should be covered by existing unit tests for `loadProductSuggestions`)
- [ ] On product detail for a bourbon the member has `have=true`: "Reach for Next" cards
  for bourbons they have show "Have" dot
- [ ] For a product the member has `tried=true` but not `have`: "Tried" dot appears
- [ ] For a product the member has `want=true`: "Want" dot appears
- [ ] For a product with no cellar relationship: no dots rendered (component returns null)
- [ ] `loved=true` alone: no dots shown (loved is excluded per conventions)
- [ ] Mobile viewport: dots are readable and don't crowd card content

## Dependencies

None. FIX-017 (subtitle on ReachForNext items) was already resolved in commit `b1ac846`.

## Estimated Total: 45 minutes
