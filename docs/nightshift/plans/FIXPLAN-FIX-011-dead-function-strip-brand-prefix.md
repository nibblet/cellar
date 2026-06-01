# Fix: [FIX-011] Dead function `stripBrandPrefix` in catalog-name-cleanup.ts

## Problem
`apps/web/src/lib/catalog/catalog-name-cleanup.ts` defines a private function
`stripBrandPrefix` (line 50–54) that is never called anywhere in the module or
exported. Biome reports `lint/correctness/noUnusedVariables` (warning). Dead code
that bloats the module and confuses future readers about intended use.

## Root Cause
The function was likely written in anticipation of a catalog-name normalization step
that strips the brand name from product display names when the brand is already
shown as a header. The step was never implemented, leaving the function stranded.

## Steps
1. Open `apps/web/src/lib/catalog/catalog-name-cleanup.ts`
2. Delete lines 50–54 (the `stripBrandPrefix` function):
   ```ts
   function stripBrandPrefix(brand: string | null, name: string): string {
     if (!brand) return name;
     const re = new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i");
     return name.replace(re, "").trim();
   }
   ```
3. Run `pnpm lint` — the `noUnusedVariables` warning for this file should be gone.
4. Run `pnpm test` to confirm nothing regressed.

## Files Modified
- `apps/web/src/lib/catalog/catalog-name-cleanup.ts` — delete dead `stripBrandPrefix`

## Verify
- [ ] `pnpm lint` no longer reports `noUnusedVariables` for `catalog-name-cleanup.ts`
- [ ] `pnpm test` 425 tests still pass
