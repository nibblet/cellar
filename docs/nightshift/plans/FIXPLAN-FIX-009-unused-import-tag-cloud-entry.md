# Fix: [FIX-009] Unused import `TagCloudEntry` in club-says-prose.ts

## Problem
`TagCloudEntry` is imported in `lib/aggregation/club-says-prose.ts` but never referenced
in the file body. Biome reports this as `lint/correctness/noUnusedImports` (error).
No functional impact, but blocks a clean `pnpm lint` run.

## Root Cause
`club-says-prose.ts` line 1 imports `{ GroupVoice, MemberTake, TagCloudEntry }` from
`./group-voice`. `TagCloudEntry` is used indirectly as part of `GroupVoice.tag_cloud`
but is not referenced directly by name anywhere in the module. The import is dead.

## Steps
1. Open `apps/web/src/lib/aggregation/club-says-prose.ts`
2. Line 1: remove `TagCloudEntry` from the import list:
   ```ts
   // Before
   import type { GroupVoice, MemberTake, TagCloudEntry } from "./group-voice";
   // After
   import type { GroupVoice, MemberTake } from "./group-voice";
   ```
3. Run `pnpm lint` — the `noUnusedImports` error for this file should be gone.
4. Run `pnpm test` to confirm nothing regressed in `club-says-prose.test.ts`.

## Files Modified
- `apps/web/src/lib/aggregation/club-says-prose.ts` — remove unused import

## Verify
- [ ] `pnpm lint` no longer reports `noUnusedImports` for `club-says-prose.ts`
- [ ] `pnpm test` 425 tests still pass
