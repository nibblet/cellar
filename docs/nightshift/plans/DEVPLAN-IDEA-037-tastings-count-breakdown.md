# Dev Plan: [IDEA-037] Enriched tasting count header on `/you/tastings`

## What This Does
The `/you/tastings` page currently shows a plain "X tastings · Y recommended" stat line at the
top of `TastingsSection`. This count is also slightly wrong: pairing entries are counted as 2
tastings in `tastingCount` but as 1 entry in `recommended` (since pairings have a single
`recommend` flag derived from both halves). Replacing the header with a richer breakdown
— "12 cigars · 8 bourbons · 3 pairings · 18 recommended" — surfaces the member's portfolio
composition at a glance and fixes the counting inconsistency.

For the 12 NCCC members, this breakdown becomes meaningful once they've logged 15–20 tastings.
It answers "am I more of a cigar person or a bourbon person?" without requiring a separate
stats page.

## User Stories
- As a member, I want to see at a glance how many cigars vs. bourbons I've tasted so I can
  understand my profile.
- As a member, I want the "recommended" count to accurately reflect how many of my tastings
  included a "Recommend to NCCC" — not an artificially inflated count.

## Implementation

### Phase 1: Fix the counting logic
1. Open `apps/web/src/components/members/sections/tastings-section.tsx`
2. Replace the current counting block (lines 20–24):
   ```ts
   // BEFORE
   const tastingCount = entries.reduce((n, e) => n + (e.kind === "pairing" ? 2 : 1), 0);
   const recommended = entries.filter((e) => e.recommend).length;

   // AFTER
   const cigarCount = entries.filter((e) => e.kind !== "pairing" && e.product_type === "cigar").length;
   const bourbonCount = entries.filter((e) => e.kind !== "pairing" && e.product_type === "bourbon").length;
   const pairingCount = entries.filter((e) => e.kind === "pairing").length;
   const recommendedCount = entries.filter((e) => e.recommend).length;
   ```
   Note: `FeedEntry` has `product_type: "cigar" | "bourbon"` from the query — verify the
   field name on `FeedTastingEntry` and `FeedPairingEntry` before using it. If `FeedPairingEntry`
   lacks `product_type`, it can be omitted from the cigar/bourbon split (only solo tastings count
   toward the type breakdown).
3. **Checkpoint:** TypeScript should compile cleanly with the new fields.

### Phase 2: Update the header render
1. In `tastings-section.tsx`, replace the stat line (currently `<p className="text-sm ...">`):
   ```tsx
   // BEFORE
   <p className="text-sm text-foreground-muted mb-4">
     {tastingCount} tasting{tastingCount === 1 ? "" : "s"}
     {recommended > 0 ? ` · ${recommended} recommended` : ""}
   </p>

   // AFTER
   <p className="text-sm text-foreground-muted mb-4">
     {cigarCount > 0 ? `${cigarCount} cigar${cigarCount === 1 ? "" : "s"}` : null}
     {cigarCount > 0 && (bourbonCount > 0 || pairingCount > 0) ? " · " : null}
     {bourbonCount > 0 ? `${bourbonCount} bourbon${bourbonCount === 1 ? "" : "s"}` : null}
     {bourbonCount > 0 && pairingCount > 0 ? " · " : null}
     {pairingCount > 0 ? `${pairingCount} pairing${pairingCount === 1 ? "" : "s"}` : null}
     {(cigarCount + bourbonCount + pairingCount) === 0 ? "Nothing logged yet." : null}
     {recommendedCount > 0 ? ` · ${recommendedCount} recommended` : null}
   </p>
   ```
   Alternatively, compose a flat string:
   ```tsx
   const parts: string[] = [];
   if (cigarCount > 0) parts.push(`${cigarCount} cigar${cigarCount === 1 ? "" : "s"}`);
   if (bourbonCount > 0) parts.push(`${bourbonCount} bourbon${bourbonCount === 1 ? "" : "s"}`);
   if (pairingCount > 0) parts.push(`${pairingCount} pairing${pairingCount === 1 ? "" : "s"}`);
   if (recommendedCount > 0) parts.push(`${recommendedCount} recommended`);

   <p className="text-sm text-foreground-muted mb-4">
     {parts.length > 0 ? parts.join(" · ") : "Nothing logged yet."}
   </p>
   ```
2. **Checkpoint:** Navigate to `/you/tastings` and confirm the breakdown displays correctly.

### Phase 3: Verify member profile page
1. `TastingsSection` is also rendered on `/members/[id]/` for other members' profiles.
   The same breakdown now appears there too — confirm it reads correctly for a member
   other than yourself.
2. **Checkpoint:** `/members/[id]` shows the correct breakdown for the viewed member.

## AI / Embedding Considerations
None. This is pure client-side arithmetic over already-loaded data. Zero API calls.

## Design System Compliance
- No brass elements added.
- No Winston voice — the stat line is plain informational text.
- Divider at section break already present.
- `formatMemberName` not touched.

## Mobile Constraints
The stat line wraps gracefully at narrow widths. The bullet-separated format works at
320px. If the full string is long ("12 cigars · 8 bourbons · 3 pairings · 18 recommended"),
consider truncating to "23 tastings · 18 recommended" for members with zero pairings to
keep the line width manageable — but only if it overflows in practice.

## Database / RLS
No DB changes. `loadFeed` already returns the entries with type information.

## Testing
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] `/you/tastings` shows correct breakdown for a member with mixed cigar/bourbon/pairing tastings
- [ ] Empty state (new member, 0 tastings) shows "Nothing logged yet." or an equivalent graceful fallback
- [ ] `/members/[id]` also shows correct breakdown for another member
- [ ] The "recommended" count is now consistent: a pairing entry that has `recommend=true` counts as 1 recommended session (correct), and the cigar/bourbon counts don't include pairings (they're counted separately)

## Dependencies
None. Standalone change to `tastings-section.tsx`.

## Estimated Total: 30 minutes
