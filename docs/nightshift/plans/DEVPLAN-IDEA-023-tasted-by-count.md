# Dev Plan: [IDEA-023] "Tasted by N members" count in ClubVoice

## What This Does
The `ClubVoice` section on product detail already shows a tag cloud of flavor words and a
recommend count, but there is no signal for how many distinct club members have actually
tried the product. Adding "Tasted by N of 12 members" directly above the tag cloud turns
the aggregate voice from an anonymous mass into a legible quorum signal — members browsing
a product can immediately see whether it's been tasted widely (9 of 12) or lightly (2 of 12)
before reading the notes.

The data is already in the `tastings` table — it's a `COUNT(DISTINCT user_id)` over existing
rows, computed from the same `tastings` array already fetched inside `loadGroupVoice`. Zero
extra DB queries. Zero AI cost. No migrations.

## User Stories
- As a member, I want to see "Tasted by 7 of 12 members" on a product so I know how well-
  sampled the group voice is before I trust the aggregate.
- As a member, I want my own tasting to count toward that number as soon as I save it, so
  the count feels live.
- As Winston (the club voice), I want the taster count to feel like a democratic signal, not
  a raw number — "7 of 12 members have weighed in" is the spirit.

## Implementation

### Phase 1: Add `taster_count` to GroupVoice type and computation

1. Open `apps/web/src/lib/aggregation/group-voice.ts`
2. Locate the `GroupVoice` type definition. Add `taster_count: number` as a required field.
3. Locate `loadGroupVoice` (the aggregation function). After building `tag_cloud` from the
   fetched tastings array, add:
   ```typescript
   const taster_count = new Set(tastings.map((t) => t.user_id)).size;
   ```
4. Include `taster_count` in the returned `GroupVoice` object.
5. **Checkpoint:** `pnpm test` — the existing group-voice unit tests should still pass.
   Add one new test:
   ```typescript
   it("counts distinct tasters correctly", () => {
     // 3 tastings from 2 users → taster_count: 2
     const voice = buildGroupVoiceFromTastings([
       { user_id: "u1", recommend: true, chips: [] },
       { user_id: "u1", recommend: true, chips: [] },
       { user_id: "u2", recommend: false, chips: [] },
     ]);
     expect(voice.taster_count).toBe(2);
   });
   ```
   Run `pnpm test` and confirm pass.

### Phase 2: Thread `taster_count` to the component

1. Open `apps/web/src/components/product/club-voice.tsx`
2. Add `taster_count: number` to the component's props type.
3. Locate the section that renders the tag cloud header (likely near `<Divider label="THE CLUB SAYS" />`
   or just below it).
4. Add a small count line immediately after the divider and before the tag cloud:
   ```tsx
   {groupVoice.taster_count > 0 && (
     <p className="text-sm text-foreground-subtle mb-3">
       Tasted by {groupVoice.taster_count} of 12 members
     </p>
   )}
   ```
   Use `text-foreground-subtle` — NOT moss (moss = pairing validation only).
5. **Checkpoint:** Navigate to any product detail with tastings. Confirm the count appears.

### Phase 3: Pass `taster_count` from product detail page

1. Open `apps/web/src/app/(app)/(shell)/products/[id]/page.tsx`
2. Locate where `loadGroupVoice` result is passed to `<ClubVoice>`. Verify that
   `groupVoice.taster_count` flows through (it should automatically since `loadGroupVoice`
   now includes it).
3. If the ClubVoice call uses a spread or explicit props, add `taster_count={groupVoice.taster_count}`.
4. **Checkpoint:** `pnpm build` — zero TypeScript errors.

## AI / Embedding Considerations
None. Pure DB aggregation from already-fetched tastings rows.

## Design System Compliance
- No brass element added — count is informational text only
- Winston not used — count is a factual aggregate, not a Winston voice moment
- Etched `<Divider label="THE CLUB SAYS" />` already present; no new divider needed
- Flavor wheel: not involved
- `formatMemberName`: not involved (no member name rendering)
- Color: `text-foreground-subtle` for the count line — not moss

## Mobile Constraints
One short line of text. No tap target. Renders above the tag cloud so it's in the natural
reading zone on iPhone without scrolling.

## Database / RLS
No new queries. `loadGroupVoice` already fetches all tastings for the product. `taster_count`
is derived from that result set client-side.

## Testing
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (including the new distinct-taster unit test)
- [ ] Product with 3+ tastings from different members shows correct count
- [ ] Product with 0 tastings shows nothing (count is guarded by `> 0`)
- [ ] Product with multiple tastings from one member shows count = 1 (distinct)
- [ ] Mobile viewport: count line readable, no layout break

## Dependencies
None. `loadGroupVoice` is already called on product detail. No prior work needed.

## Estimated Total: 30 minutes
