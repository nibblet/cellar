# Fix: [FIX-001] Identity invariant — raw contributor name in product detail

## Problem
On the product detail page, photo contributor names are rendered as:
```tsx
`${r.contributor.name_first} ${r.contributor.name_last_initial}`
```
This bypasses `formatMemberName()`, the single source of truth for member display.

Impact: the `.name_last_initial` is not uppercased (formatMemberName calls `.toUpperCase()` on it); trailing whitespace is not trimmed; and if the two-Paul case ever produces ambiguity logic inside `formatMemberName`, this inline string will diverge silently.

## Root Cause
`apps/web/src/app/(app)/(shell)/products/[id]/page.tsx` line 143:
```tsx
const contributor = r.contributor
  ? `${r.contributor.name_first} ${r.contributor.name_last_initial}`
  : null;
```
The file already imports `formatMemberName` — it just wasn't used here.

Wait: actually checking the imports in `products/[id]/page.tsx` — `formatMemberName` is NOT imported. The file builds contributor strings inline.

## Steps
1. Open `apps/web/src/app/(app)/(shell)/products/[id]/page.tsx`
2. Add `formatMemberName` to the import from `@/lib/identity`:
   ```ts
   // Before: no identity import in this file
   // After: add at top with other imports
   import { formatMemberName } from "@/lib/identity";
   ```
3. Find the contributor mapping block (around line 139–147):
   ```tsx
   // Before:
   const contributor = r.contributor
     ? `${r.contributor.name_first} ${r.contributor.name_last_initial}`
     : null;
   ```
   Change to:
   ```tsx
   // After:
   const contributor = r.contributor ? formatMemberName(r.contributor) : null;
   ```
4. Verify the `ProductHeroImage` type accepts `contributor: string | null` — it does (unchanged).
5. Run `pnpm build` to verify.
6. Run `pnpm lint`.

## Files Modified
- `apps/web/src/app/(app)/(shell)/products/[id]/page.tsx` — add formatMemberName import, use it for contributor string

## New Files (if any)
None.

## Database Changes (if any)
None.

## Verify
- [x] Build passes
- [x] Lint passes
- [ ] Navigate to a product detail page that has member-contributed photos — contributor name displays as "First L" format
- [ ] Contributor name for Paul Cobb displays as "Paul C" (not "Paul c" or "Paul C " with trailing space)
