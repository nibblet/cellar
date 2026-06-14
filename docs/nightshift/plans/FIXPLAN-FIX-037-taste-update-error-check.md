# Fix: [FIX-037] taste/load.ts missing error check on UPDATE users SET taste_recommendations

## Problem
After rebuilding taste recommendations, `rebuild()` writes the freshly-computed result back to the `users` table cache. The Supabase update call at lines 191–194 has no error destructuring or error check. If the write fails silently:
1. The function still returns the correct recommendations for this call (fine for this page render).
2. The `taste_recommendations` cache is NOT updated on the DB.
3. The next page load recomputes everything from scratch — including the `attachRationales` call that generates 6 GPT-5-nano rationale lines.
4. Every subsequent load triggers the same unnecessary LLM cost until the write eventually succeeds.

Low-severity (DB writes rarely fail permanently) but adds silent cost accumulation on repeated failures. Pattern: log a warning, matching the convention in `specs-enrich.ts`.

## Root Cause
`apps/web/src/lib/taste/load.ts` lines 191–194:
```ts
await supabase
  .from("users")
  .update({ taste_recommendations: recommendations })
  .eq("id", memberId);
// ← no error check; silent failure means LLM rationales re-run every load
```

## Steps
1. Open `apps/web/src/lib/taste/load.ts`
2. Replace lines 191–194:
   ```ts
   // Before
   await supabase
     .from("users")
     .update({ taste_recommendations: recommendations })
     .eq("id", memberId);

   // After
   const { error: updateErr } = await supabase
     .from("users")
     .update({ taste_recommendations: recommendations })
     .eq("id", memberId);
   if (updateErr) {
     console.warn("[taste/load] taste_recommendations cache write failed:", updateErr.message);
   }
   ```
3. Run `pnpm lint`
4. Run `pnpm build`
5. Run `pnpm test -- taste` if taste lib tests exist

## Files Modified
- `apps/web/src/lib/taste/load.ts` — destructure + log error from cache write

## New Files
None.

## Database Changes
None.

## Verify
- [ ] Build passes
- [ ] Lint passes
- [ ] Normal happy path: no visible change (cache write succeeds silently as before)
- [ ] On simulated write failure: `console.warn` fires with message; function still returns correct recommendations
