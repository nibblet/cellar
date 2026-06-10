# Fix: [FIX-030] Duplicate cellar + taste DB calls in `loadFindNextSuggestions`

## Problem

`loadFindNextSuggestions` in `lib/find-next/load.ts` calls `loadProductSuggestions` twice —
once for `"bourbon"` and once for `"cigar"` — inside a `Promise.all`. Each call independently
executes `loadCellarSnapshot(supabase, memberId)` and `ensureTasteRecommendations(supabase, memberId)`.
Both functions hit Supabase with the same member ID. Since they run in parallel, the connection
pool receives two identical `loadCellarSnapshot` queries and two identical
`ensureTasteRecommendations` calls simultaneously.

For the find-next feed section, this means every page render fires 2× the necessary DB queries
for cellar state and taste recommendations — the two most expensive reads in the call tree.

Impact: ~2 extra DB roundtrips per member per feed page load. For 12 users on a Vercel
serverless function with a cold Supabase TCP connection, each round-trip is ~20–40ms. Cumulative
latency on the critical-path server render is ~40–80ms avoidable overhead.

## Root Cause

`apps/web/src/lib/find-next/load.ts`, `loadProductSuggestions` (lines 116–180):

```typescript
async function loadProductSuggestions(
  supabase: SupabaseClient,
  memberId: string,
  productType: ProductType,
): Promise<FindNextProductSuggestion[]> {
  const [cellar, recommendations] = await Promise.all([
    loadCellarSnapshot(supabase, memberId),       // ← runs twice (once per type)
    ensureTasteRecommendations(supabase, memberId), // ← runs twice (once per type)
  ]);
  ...
}
```

Called in `loadFindNextSuggestions` (lines 64–71):
```typescript
const [pairing, pour, smoke] = await Promise.all([
  loadPairingSuggestions(supabase, memberId, preferences),
  loadProductSuggestions(supabase, memberId, "bourbon"), // ← own cellar + taste load
  loadProductSuggestions(supabase, memberId, "cigar"),   // ← same cellar + taste load again
]);
```

## Steps

1. Open `apps/web/src/lib/find-next/load.ts`

2. Refactor `loadFindNextSuggestions` to hoist the shared loads:

```typescript
export async function loadFindNextSuggestions(
  supabase: SupabaseClient,
  memberId: string,
  preferences: import("@/lib/preferences/types").MemberPreferences | null,
): Promise<FindNextSuggestions> {
  // Hoist shared loads — fetched once, shared by both product-type paths.
  const [snapshot, recommendations] = await Promise.all([
    loadCellarSnapshot(supabase, memberId),
    ensureTasteRecommendations(supabase, memberId),
  ]);

  const [pairing, pour, smoke] = await Promise.all([
    loadPairingSuggestions(supabase, memberId, preferences),
    loadProductSuggestions(supabase, memberId, "bourbon", snapshot, recommendations),
    loadProductSuggestions(supabase, memberId, "cigar", snapshot, recommendations),
  ]);

  return { pairing, pour, smoke };
}
```

3. Update the signature of `loadProductSuggestions` to accept pre-loaded data:

```typescript
async function loadProductSuggestions(
  supabase: SupabaseClient,
  memberId: string,
  productType: ProductType,
  cellar: Awaited<ReturnType<typeof loadCellarSnapshot>>,
  recommendations: Awaited<ReturnType<typeof ensureTasteRecommendations>>,
): Promise<FindNextProductSuggestion[]> {
  const tasteByType = await loadTasteByType(supabase, cellar);
  const tasteVector = tasteByType[productType].tasteVector;
  const haveIds = [...cellar.have];
  // ... rest unchanged, replace local 'cellar' and 'recommendations' references
```

4. Remove the `Promise.all([loadCellarSnapshot, ensureTasteRecommendations])` from inside
   `loadProductSuggestions` since the data is now passed in.

5. Add imports for the types if needed (use `import type`).

6. Run `pnpm build` to verify TypeScript.

7. Run `pnpm lint` (Biome).

8. Run `pnpm test` — `lib/find-next/load.test.ts` tests `mergePairSuggestions` and
   `mergeProductSuggestions`, not `loadFindNextSuggestions` directly. Verify those still pass.
   If `loadFindNextSuggestions` is integration-tested anywhere, check those too.

9. Test: load the feed page (or you/cellar) and verify the Find Your Next section still
   renders the correct bourbon and cigar suggestions.

## Files Modified

- `apps/web/src/lib/find-next/load.ts` — hoist shared loads, update `loadProductSuggestions` signature

## New Files (if any)

None.

## Database Changes (if any)

None.

## Verify

- [ ] Build passes
- [ ] Lint passes
- [ ] `pnpm test` passes (find-next tests)
- [ ] Feed page "Find Your Next" section renders bourbon + cigar suggestions correctly
- [ ] Cellar page "Try Next" section unaffected (different call path)
- [ ] Network tab in DevTools shows 2 fewer Supabase API calls per find-next load

## Note

`loadPairingSuggestions` also calls `loadPickPourCandidates` + `loadDailyPourCandidates`
internally — those are not duplicated. Only the cellar snapshot and taste recommendations
were being duplicated by the bourbon/cigar split.
