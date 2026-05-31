# Fix: [FIX-006] Unused `release_label_source` variable in product detail page

## Problem
`noUnusedVariables` lint error in `products/[id]/page.tsx`. No functional impact — the variable
is never read — but it's a Biome error that inflates the lint failure count and makes it harder
to notice real lint issues.

## Root Cause
`apps/web/src/app/(app)/(shell)/products/[id]/page.tsx` line 60 destructures `release_label_source`
from `searchParams` but never uses it. The value was previously passed to the tasting form but
the flow was changed to infer the source from context.

## Steps
1. Open `apps/web/src/app/(app)/(shell)/products/[id]/page.tsx`
2. Line 60 — remove `release_label_source` from the destructure:

   **Before:**
   ```ts
   const { just_captured, just_saved, event, release_label, release_label_source } =
     await searchParams;
   ```

   **After:**
   ```ts
   const { just_captured, just_saved, event, release_label } =
     await searchParams;
   ```

3. Also remove `release_label_source?` from the `SearchParams` type on line 49 (optional cleanup,
   not a lint error since it's a type definition):

   **Before:**
   ```ts
   type SearchParams = Promise<{
     just_captured?: string;
     just_saved?: string;
     event?: string;
     release_label?: string;
     release_label_source?: string;
   }>;
   ```

   **After:**
   ```ts
   type SearchParams = Promise<{
     just_captured?: string;
     just_saved?: string;
     event?: string;
     release_label?: string;
   }>;
   ```

4. Run `pnpm lint` — `noUnusedVariables` error should be gone
5. Run `pnpm build` to confirm no TS errors

## Files Modified
- `apps/web/src/app/(app)/(shell)/products/[id]/page.tsx` — remove unused destructured variable

## Verify
- [ ] `pnpm lint` passes (or at least no `noUnusedVariables` errors)
- [ ] `pnpm build` passes
- [ ] Product detail page still loads correctly
