# Dev Plan: [IDEA-019] Club want-count on Want shelf

## What This Does
When a member browses their Want shelf on the Cellar page, a small "N others want this" line appears
beneath each product's subtitle for any bottle that 2 or more other club members also want. For a
12-person private group, this turns the Want shelf into a social hunting list — members can see at
a glance that 4 others are chasing the same Pappy 15, or that they're alone in wanting a specific
single-barrel release. Zero AI cost, no new DB columns, pure server-side aggregate of the
`member_saves` table.

This is private social signal, not a public profile. It follows the existing pattern of the
app surfacing collective club data (rec counts, tag clouds, validated pairings) without creating
follower graphs or public feeds.

## User Stories
- As a member browsing my Want shelf, I want to see if others in the club are hunting the same
  bottles, so that we can coordinate on finds at retailers.
- As Winston, I want the Want shelf to feel like a shared club list, not just a personal
  grocery list.

## Implementation

### Phase 1: Data function
1. Open `apps/web/src/lib/cellar/load.ts` (or whichever file exports cellar loading functions).
2. Add a new exported function:
   ```typescript
   export async function loadWantOverlapCounts(
     supabase: SupabaseClient,
     memberId: string,
   ): Promise<Map<string, number>> {
     // Count how many OTHER members want each product.
     const { data } = await supabase
       .from("member_saves")
       .select("product_id")
       .eq("want", true)
       .neq("member_id", memberId);
     if (!data) return new Map();
     const counts = new Map<string, number>();
     for (const row of data) {
       counts.set(row.product_id, (counts.get(row.product_id) ?? 0) + 1);
     }
     return counts;
   }
   ```
   This query fetches all want=true rows except the caller's own. With 12 members and a small
   catalog, this is a low-cardinality result (< 200 rows total). No join needed.
3. **Checkpoint:** `pnpm test` passes; no existing tests affected.

### Phase 2: Thread count into CellarSection
1. Open `apps/web/src/app/(app)/(shell)/you/cellar/page.tsx`.
2. In the `YouCellarPage` component, fetch the overlap map alongside existing data:
   ```typescript
   const [cellarSnapshot, wantOverlapCounts] = await Promise.all([
     loadCellarSnapshot(supabase, auth.user.id),
     loadWantOverlapCounts(supabase, auth.user.id),
   ]);
   ```
   (Add import from `@/lib/cellar/load`.)
3. Pass `wantOverlapCounts` as a prop to `<CellarSection>`:
   ```tsx
   <CellarSection
     memberId={auth.user.id}
     memberFirstName={profile.name_first}
     isOwnProfile={true}
     wantOverlapCounts={wantOverlapCounts}
   />
   ```
4. **Checkpoint:** TypeScript will error until `CellarSection` accepts the prop. Move to Phase 3.

### Phase 3: Render hint on Want cards
1. Open `apps/web/src/components/members/sections/cellar-section.tsx`.
2. Add optional prop: `wantOverlapCounts?: Map<string, number>`. Default: `new Map()` or omit.
3. In the Want section's card render, for each product add — when `isOwnProfile` is true and the
   count is >= 2:
   ```tsx
   {wantOverlapCounts?.get(product.id) >= 2 ? (
     <p className="text-xs text-foreground-subtle mt-1">
       {wantOverlapCounts.get(product.id)} others want this
     </p>
   ) : null}
   ```
   Threshold of 2 prevents noise from a single other member's overlap — it's meaningful only
   when multiple members are chasing the same bottle.
4. Only show on `isOwnProfile === true` (seeing your own Want shelf). Other member profile views
   do NOT show this hint — it would leak which other members want the same bottle.
5. **Checkpoint:** Visit `/you/cellar`, Want section. Any bottle wanted by 2+ others shows the
   count beneath the subtitle.

### Phase 4: Lint and build
1. Run `pnpm lint` (Biome) — ensure no `noUnusedVariables` or import issues.
2. Run `pnpm build`.
3. Run `pnpm test`.

## AI / Embedding Considerations
None. This is a pure DB aggregate — no AI calls, no embeddings, no external services.

## Design System Compliance
- No brass element added (the hint is plain text).
- No `<Voice />` component used (this is catalog data, not a Winston moment).
- `formatMemberName` is not called (no names rendered — just a count).
- No moss color used (no pairing validation implied).

## Mobile Constraints
- Text hint is a small `text-xs` line below the subtitle — single-handed readable, no tap target.
- No layout change; cards are the same size.

## Database / RLS
No new columns or migrations. `member_saves` is readable by authenticated members (existing RLS).
The query uses `neq("member_id", memberId)` to exclude own saves; this is a client-side filter
for correct counts, not a privacy mechanism (RLS handles that).

## Testing
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (no existing tests for cellar-section; if unit tests exist for load.ts,
  add a test for `loadWantOverlapCounts` returning correct counts excluding caller's own row)
- [ ] Want shelf shows "N others want this" for products wanted by 2+ other members
- [ ] Count is NOT shown when only 1 other member wants the item (below threshold)
- [ ] Hint does NOT appear on another member's profile Want view (`isOwnProfile === false`)

## Dependencies
None. `member_saves` is already fully populated.

## Estimated Total: ~45 minutes
