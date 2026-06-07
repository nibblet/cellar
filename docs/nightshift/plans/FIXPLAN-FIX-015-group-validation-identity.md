# Fix: [FIX-015] Identity invariant in group-validation.ts

## Problem
Two locations in `lib/pairing/group-validation.ts` build a `display_name` string with a raw template literal instead of `formatMemberName`. When a pairing earns a moss "club validated" badge, the validator's name is displayed in the pairing detail UI using the raw `name_first` + `name_last_initial` fields. This bypasses the identity formatter, missing uppercase normalization and — critically — the two-Paul disambiguation logic that `formatMemberName` will enforce once two members share a first name.

## Root Cause
`checkEventValidation` (line 76) and `checkPairingSessionValidation` (line 137) both construct:
```ts
display_name: `${t.user.name_first} ${t.user.name_last_initial}`,
```
`formatMemberName` is not imported in this file.

## Steps
1. Open `apps/web/src/lib/pairing/group-validation.ts`
2. Add the import at the top (after the existing `@supabase/supabase-js` import):
   ```ts
   import { formatMemberName } from "@/lib/identity";
   ```
3. Replace line 76:
   ```ts
   // before
   display_name: `${t.user.name_first} ${t.user.name_last_initial}`,
   // after
   display_name: formatMemberName(t.user),
   ```
4. Replace line 137:
   ```ts
   // before
   display_name: `${session.user.name_first} ${session.user.name_last_initial}`,
   // after
   display_name: formatMemberName(session.user),
   ```
5. Run `pnpm build` to verify no TypeScript errors.
6. Run `pnpm lint`.

## Files Modified
- `apps/web/src/lib/pairing/group-validation.ts` — add `formatMemberName` import, use it on lines 76 and 137

## Verify
- [x] Build passes
- [x] Lint passes (changed files clean; repo-wide lint has pre-existing failures)
- [ ] On a pairing detail page where the pairing has a club-validated badge, the validator's name renders correctly as "First L" format
- [ ] No regression on pairing detail pages with no validation

**Fixed:** 2026-06-03
