# Fix: [FIX-007] `mcpGetClubFeed` `recommends_only` filter under-delivers results

## Problem
When a Claude MCP caller passes `recommends_only: true` to `get_club_feed`, the tool may return
fewer entries than the requested `limit`. For example, asking for 10 recommend-only entries may
return only 2–3 if most recent tastings were non-recommends. This makes the tool unreliable for
queries like "what has the club been recommending lately?"

## Root Cause
`apps/web/src/lib/mcp/tools.ts` function `mcpGetClubFeed` (around line 668):

```ts
const limit = Math.min(input.limit ?? 10, 25);
const items = await loadFeed(supabase, {
  limit,              // ← fetches only `limit` items from DB
  productType: input.product_type,
});
const filtered = input.recommends_only ? items.filter((i) => i.recommend) : items;
return success({ entries: filtered.slice(0, limit).map(toClubFeedEntry) });
```

`loadFeed` fetches `limit` rows from the DB, then the code filters for `recommend === true`
client-side. If the club hasn't recommended most of the recent items, `filtered` ends up much
shorter than `limit`.

## Steps
1. Open `apps/web/src/lib/mcp/tools.ts`
2. In `mcpGetClubFeed`, change the fetch to use an oversampled limit when `recommends_only` is
   true, so there's enough headroom to fill the requested count after filtering:

   **Before:**
   ```ts
   const limit = Math.min(input.limit ?? 10, 25);
   const items = await loadFeed(supabase, {
     limit,
     productType: input.product_type,
   });
   const filtered = input.recommends_only ? items.filter((i) => i.recommend) : items;
   return success({
     entries: filtered.slice(0, limit).map(toClubFeedEntry),
   });
   ```

   **After:**
   ```ts
   const limit = Math.min(input.limit ?? 10, 25);
   const fetchLimit = input.recommends_only ? Math.min(limit * 5, 100) : limit;
   const items = await loadFeed(supabase, {
     limit: fetchLimit,
     productType: input.product_type,
   });
   const filtered = input.recommends_only ? items.filter((i) => i.recommend) : items;
   return success({
     entries: filtered.slice(0, limit).map(toClubFeedEntry),
   });
   ```

   Rationale: fetch up to 5× the requested limit (capped at 100) when filtering, so even if only
   20% of tastings are recommends, a request for 10 will likely fill. For NCCC's 12 members and
   typical recommend rates, this is more than sufficient.

3. Run `pnpm test` — no lib tests cover this function but confirm no regressions
4. Run `pnpm build` to confirm no TS errors

## Files Modified
- `apps/web/src/lib/mcp/tools.ts` — oversample when `recommends_only` is true

## Verify
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] Manual: call `get_club_feed` with `recommends_only=true, limit=10` and confirm ≤10 but as
      close to 10 recommend entries as the DB contains
