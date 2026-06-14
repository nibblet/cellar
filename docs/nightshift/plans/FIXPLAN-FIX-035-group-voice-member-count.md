# Fix: [FIX-035] GroupVoice.member_count uses tasting row count, not distinct member count

## Problem
`RecommendBar` on the product detail page shows "{recommendCount} of {memberCount}" members who would recommend.  
When a member has tasted the same product under two different release labels, they appear as two separate `tastings` rows (upsert key is `(user_id, product_id, release_label)`). `loadGroupVoice` returns `member_count: tastings.length` — counting rows, not people. The bar renders 2 icons for 1 member and shows "2 of 2" when one person tried two vintages. Low-severity for the 12-person club but semantically incorrect and misleading.

## Root Cause
`apps/web/src/lib/aggregation/group-voice.ts` lines 84 and 76:
```ts
// line 76 — counts every row where recommend=true, not distinct members
const recommend_count = tastings.reduce((n, t) => (t.recommend ? n + 1 : n), 0);

// line 84 — counts tasting rows, not distinct user_ids
member_count: tastings.length,
```

## Steps
1. Open `apps/web/src/lib/aggregation/group-voice.ts`
2. Replace line 76:
   ```ts
   // Before
   const recommend_count = tastings.reduce((n, t) => (t.recommend ? n + 1 : n), 0);
   // After
   const recommend_count = new Set(tastings.filter((t) => t.recommend).map((t) => t.user_id)).size;
   ```
3. Replace line 84:
   ```ts
   // Before
   member_count: tastings.length,
   // After
   member_count: new Set(tastings.map((t) => t.user_id)).size,
   ```
4. Open `apps/web/src/lib/aggregation/group-voice.test.ts`
5. Find any test that asserts `member_count` or `recommend_count` with multi-release fixture data and update expected values to reflect distinct-user semantics.
6. Run `pnpm test -- group-voice` to confirm tests pass.
7. Run `pnpm lint`
8. Run `pnpm build`

## Files Modified
- `apps/web/src/lib/aggregation/group-voice.ts` — lines 76 and 84: distinct-user Sets instead of row counts
- `apps/web/src/lib/aggregation/group-voice.test.ts` — update test expectations if multi-release fixture exists

## New Files
None.

## Database Changes
None.

## Verify
- [ ] Build passes
- [ ] Lint passes
- [ ] Tests pass for group-voice.ts
- [ ] Product detail with a single-release product: member_count and recommend_count unchanged
- [ ] Product detail where one member has two release rows: member_count shows 1 (not 2), recommend_count shows 1 if they recommended either release
- [ ] RecommendBar renders correct icon count (1 icon for 1 member even with 2 release tastings)
