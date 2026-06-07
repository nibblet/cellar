# Fix: [FIX-017] `subtitle` missing from shelf-scored ReachForNextPick

## Problem

`pnpm build` will fail with a TypeScript type error. In commit `3b1acfb`,
`AdjacentProduct.subtitle: string | null` was added as a required field. The
`suggestAdjacentProducts` function now computes and returns the field. However,
`loadReachForNext` in `lib/suggestions/load-product-suggestions.ts` also
constructs `ReachForNextPick` objects (which extend `AdjacentProduct`) manually
for the shelf-first path — and those objects do not include `subtitle`. TypeScript
strict mode will reject the object literal as missing a required property.

Members on the shelf path (most common case) see "Reach for next" cards but would
get `subtitle` as `undefined` at runtime — invisible in the "Reach for next" section
(which doesn't render it yet) but a latent type hole.

## Root Cause

`load-product-suggestions.ts` lines 108–117: manually constructed `ReachForNextPick`
from shelf rows. The construction predates the `subtitle` field addition. `suggestAdjacentProducts`
computes `subtitle` from `composeProductSubtitle`, but the shelf path does the same
aggregation manually and never calls `composeProductSubtitle`.

```ts
// current — missing subtitle
return {
  product_id: row.id,
  name: row.name,
  brand: row.brand,
  similarity,
  tier,
  price_usd,
  onShelf: true,
  source: "cellar" as const,
};
```

## Steps

1. Open `apps/web/src/lib/suggestions/load-product-suggestions.ts`.

2. Add the import for `composeProductSubtitle` near the top of the file, alongside
   the existing `suggestAdjacentProducts` import:

   ```ts
   import { composeProductSubtitle } from "@/lib/catalog/product-subtitle";
   ```

3. In the shelf-scored mapping (around line 96), determine the product type for
   the shelf item. The source product type is already in scope as `source.type`
   (the `source` arg passed to `loadReachForNext`). Use it to call
   `composeProductSubtitle`.

4. Update the returned object (lines 108–117) to include `subtitle`:

   ```ts
   return {
     product_id: row.id,
     name: row.name,
     brand: row.brand,
     similarity,
     tier,
     price_usd,
     subtitle: composeProductSubtitle(source.type, row.specs ?? {}),
     onShelf: true,
     source: "cellar" as const,
   };
   ```

5. Run `pnpm build` from `apps/web/` to verify the type error is resolved.

6. Run `pnpm lint` to confirm no new lint errors.

7. Run `pnpm test` — `lib/` is touched. The existing `suggest-adjacent.test.ts`
   and `product-subtitle.test.ts` cover the functions called; no new tests needed.

## Files Modified

- `apps/web/src/lib/suggestions/load-product-suggestions.ts` — add `composeProductSubtitle`
  import; add `subtitle` field to shelf-scored `ReachForNextPick` construction.

## Verify

- [x] `pnpm build` passes (was failing on missing property)
- [x] `pnpm lint` passes (changed files clean; repo-wide lint has pre-existing failures)
- [x] `pnpm test` passes
- [ ] On product detail: "Reach for next" card for a shelf item no longer has
      `undefined` for subtitle (verify in browser dev tools, network tab, or just
      by confirming build succeeds)

**Fixed:** 2026-06-03
