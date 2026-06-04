# Fix: [FIX-020] Dead `YouMightAlsoLike` component — exported but never imported

## Problem
`apps/web/src/components/product/you-might-also-like.tsx` exports a `YouMightAlsoLike` component that is re-exported from the barrel (`components/product/index.ts`) but never imported in any page or component. It was superseded by the `WinstonSuggests` component (shipped 2026-06-01) which handles the same "similar products" use case inside the broader suggestion panel. The dead file adds dead weight to the product component barrel and creates confusion about which component to use for adjacent-product display.

## Root Cause
`YouMightAlsoLike` was likely the initial implementation before `WinstonSuggests` unified the suggestion surface. The file was not deleted when `WinstonSuggests` superseded it.

## Steps

1. Delete the component file:
   ```bash
   rm apps/web/src/components/product/you-might-also-like.tsx
   ```

2. Open `apps/web/src/components/product/index.ts` and remove the export:

   Remove line:
   ```ts
   export { YouMightAlsoLike } from "./you-might-also-like";
   ```

3. Run `pnpm lint` from `apps/web/` to confirm no remaining references.
4. Run `pnpm build` to confirm TypeScript is clean.

## Files Modified
- `apps/web/src/components/product/index.ts` — remove `YouMightAlsoLike` re-export

## Files Deleted
- `apps/web/src/components/product/you-might-also-like.tsx`

## Verify
- [ ] Build passes
- [ ] Lint passes
- [ ] Grep for `YouMightAlsoLike` returns zero results in `src/`
