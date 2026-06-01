# Fix: [FIX-012] Deprecated dead constant + `let` vs `const` in expression-normalize.ts

## Problem
Two issues in `apps/web/src/lib/catalog/expression-normalize.ts`:

1. `VINTAGES_MATTER_PATTERNS` (line 65) — declared as a non-empty-typed array but
   intentionally empty, marked `@deprecated`. Never read anywhere. Biome reports
   `lint/correctness/noUnusedVariables` (warning). It was deprecated when the
   "all expressions use tasting chips" decision was made; the empty array is pure
   dead weight.

2. Line 684: `let canonical = stripReleaseSuffixes(input.name)` — `canonical` is
   assigned once and never reassigned. Biome reports `lint/style/useConst` (warning).

## Root Cause
`VINTAGES_MATTER_PATTERNS` was scaffolded when the plan was to auto-classify which
bourbon expressions group by vintage year. That grouping was moved to tasting chips;
the variable was emptied but not deleted. The `let canonical` is a stale style from
before the function was simplified to a single assignment path.

## Steps
1. Open `apps/web/src/lib/catalog/expression-normalize.ts`

2. Delete lines 63–65 (the deprecated empty array):
   ```ts
   /** Canonical names that group tastings by release year on the product page. */
   /** @deprecated All expressions use tasting chips; product pages do not group by year. */
   const VINTAGES_MATTER_PATTERNS: Array<{ match: RegExp; pattern: ReleasePattern }> = [];
   ```

3. Line 684: change `let` → `const`:
   ```ts
   // Before
   let canonical = stripReleaseSuffixes(input.name);
   // After
   const canonical = stripReleaseSuffixes(input.name);
   ```

4. Run `pnpm lint` — both warnings for this file should be gone.
5. Run `pnpm test` to confirm `expression-normalize.test.ts` still passes.

## Files Modified
- `apps/web/src/lib/catalog/expression-normalize.ts` — remove dead constant; `let` → `const`

## Verify
- [ ] `pnpm lint` no longer reports `noUnusedVariables` or `useConst` for this file
- [ ] `pnpm test` 425 tests still pass
