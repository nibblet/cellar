# Fix: [FIX-010] Unused local import `productNeedsCatalogEnrichment` in enrich/index.ts

## Problem
`apps/web/src/lib/enrich/index.ts` line 11 imports `{ productNeedsCatalogEnrichment }`
from `./needs-enrichment` into the local scope. The function is never called within
`index.ts` — it is only re-exported on line 21 via `export { productNeedsCatalogEnrichment }
from "./needs-enrichment"` (a direct barrel re-export that does not consume the local
import). Biome reports `lint/correctness/noUnusedImports` (error).

## Root Cause
The local import at line 11 was likely added before the direct `export { } from` syntax
was introduced. Once the barrel re-export was in place, the local import became dead.

## Steps
1. Open `apps/web/src/lib/enrich/index.ts`
2. Remove line 11:
   ```ts
   // Before (lines 9-13)
   import { ApifyClient } from "./apify-client";
   import { type ApifyEnrichResult, type EnrichInput, enrichProductFromWeb } from "./apify-enrich";
   import { productNeedsCatalogEnrichment } from "./needs-enrichment";        // ← remove this
   import { extractAndMergeSpecs, type SpecsEnrichResult } from "./specs-enrich";
   import { extractAndMergeWheelVector, type WheelEnrichResult } from "./wheel-enrich";
   ```
3. Confirm `productNeedsCatalogEnrichment` is still exported via the barrel re-export on
   line 21 (`export { productNeedsCatalogEnrichment } from "./needs-enrichment"`).
4. Run `pnpm lint` — error should be gone.
5. Run `pnpm build` to confirm the export is still resolvable for consumers.

## Files Modified
- `apps/web/src/lib/enrich/index.ts` — remove unused local import (line 11)

## Verify
- [ ] `pnpm lint` no longer reports `noUnusedImports` for `enrich/index.ts`
- [ ] `pnpm build` passes
- [ ] Callers of `productNeedsCatalogEnrichment` (e.g., product detail page) still resolve
