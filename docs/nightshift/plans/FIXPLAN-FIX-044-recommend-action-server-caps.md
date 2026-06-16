# Fix: [FIX-044] Missing server-side length caps on `note` and `releaseLabel` in recommend action

## Problem
`apps/web/src/app/(app)/(shell)/products/[id]/recommend/actions.ts` applies `.trim()` to `note`
and `releaseLabel` but no `.slice(n)` length cap. A direct POST to the Server Action (bypassing
the client-rendered form) can persist an arbitrarily long string to the `tastings` table.

- `note` has a `maxLength={500}` client-side textarea constraint that is not enforced server-side.
- `releaseLabel` has no client constraint and no server cap. FIX-027 tracks the same gap in
  `recommend/page.tsx` URL param, and FIX-032 tracks it in `session/actions.ts`. This is the
  third instance of the same class.

**Impact on members:** Low (12 trusted members, no adversarial users). Principally a data
hygiene and consistency issue. Could cause subtle UI truncation/overflow if a very long value
is stored and rendered unguarded downstream.

## Root Cause
`apps/web/src/app/(app)/(shell)/products/[id]/recommend/actions.ts`:
- Line ~34: `const note = String(formData.get("note") ?? "").trim()` — no length cap
- Line ~36: `const releaseLabel = String(formData.get("release_label") ?? "").trim() || null` — no length cap

## Steps
1. Open `apps/web/src/app/(app)/(shell)/products/[id]/recommend/actions.ts`
2. Find the `note` extraction line and add `.slice(0, 500)`:
   ```ts
   // BEFORE
   const note = String(formData.get("note") ?? "").trim();
   // AFTER
   const note = String(formData.get("note") ?? "").trim().slice(0, 500);
   ```
3. Find the `releaseLabel` extraction line and add `.slice(0, 100)`:
   ```ts
   // BEFORE
   const releaseLabel = String(formData.get("release_label") ?? "").trim() || null;
   // AFTER
   const releaseLabel = String(formData.get("release_label") ?? "").trim().slice(0, 100) || null;
   ```
4. While in the file, optionally add chips count + length guard (low priority):
   ```ts
   // OPTIONAL — guards chips array against oversized input
   const chips = (formData.getAll("chips") as string[])
     .map((c) => c.trim())
     .filter(Boolean)
     .slice(0, 20)                        // max 20 chips
     .map((c) => c.slice(0, 50));         // max 50 chars each
   ```
5. Run `pnpm lint`
6. Run `pnpm build`
7. Test: submit the recommend form normally — confirm no regression in the happy path

## Files Modified
- `apps/web/src/app/(app)/(shell)/products/[id]/recommend/actions.ts` — `.slice(0, 500)` on note, `.slice(0, 100)` on releaseLabel

## New Files
None.

## Verify
- [ ] Build passes
- [ ] Lint passes
- [ ] Normal form submission still works (note ≤ 500 chars, release label ≤ 100 chars)
- [ ] Apply FIX-027 (recommend page URL param) and FIX-032 (session/actions.ts) in the same session for a complete input-validation sweep
