# Dev Plan: [IDEA-029] Re-taste Shortcut from Tasting History

## What This Does
Adds a "Try again →" link to each tasting card in the `/you/tastings` history view. Tapping it
navigates directly to the recommend form pre-loaded with the same product and, when a release
label was logged, that label pre-filled. Members who taste the same bourbon or cigar across
multiple vintages can log a follow-up tasting without searching for the product again. Especially
useful for annual releases (Buffalo Trace Antique Collection, etc.).

The link appears only in the personal `/you/tastings` history view, not in the main club feed
or other members' profiles — it is not surfaced on another member's tasting cards.

## User Stories
- As a member, I want to log a follow-up tasting for a product I've tried before so that I can
  track how my notes change across vintages without navigating back to search.
- As Winston (the club voice), I want every re-taste to flow smoothly so that more tastings get
  logged and the collective voice grows richer over time.

## Implementation

### Phase 1: Thread the prop

1. Open `apps/web/src/components/feed/tasting-card.tsx`

2. Add `showRetaste?: boolean` to `TastingCardProps`:
   ```typescript
   type TastingCardProps = {
     entry: FeedTastingEntry;
     signedHero: string | null;
     forYou?: boolean;
     showRetaste?: boolean;  // ← add
   };
   ```

3. Destructure `showRetaste = false` in the function signature.

4. In the info strip section (below the note, around line 112), add:
   ```tsx
   {showRetaste ? (
     <div className="px-3.5 pb-3 -mt-0.5">
       <a
         href={`/products/${entry.product_id}/recommend${entry.release_label ? `?release_label=${encodeURIComponent(entry.release_label)}` : ""}`}
         className="text-[12px] text-foreground-muted hover:text-foreground"
         onClick={(e) => e.stopPropagation()}
       >
         Try again →
       </a>
     </div>
   ) : null}
   ```
   
   Note: `e.stopPropagation()` is needed because the card is wrapped in a `<Link>` — the inner
   anchor needs to prevent the outer Link from firing. Use a plain `<a>` tag, not `<Link>`, to
   avoid nested-link semantics issues.

   **Checkpoint:** The card compiles and renders "Try again →" when `showRetaste={true}`.

### Phase 2: Activate on the personal history page

5. Open `apps/web/src/components/members/sections/tastings-section.tsx`

6. Add `showRetaste?: boolean` to the component props:
   ```typescript
   export async function TastingsSection({
     memberId,
     displayName,
     showRetaste = false,  // ← add
   }: {
     memberId: string;
     displayName: string;
     showRetaste?: boolean;
   })
   ```

7. Pass `showRetaste` through to `TastingCard` in the map:
   ```tsx
   <TastingCard
     key={entry.tasting_id}
     entry={entry}
     signedHero={...}
     showRetaste={showRetaste}
   />
   ```

8. Open `apps/web/src/app/(app)/(shell)/you/tastings/page.tsx`

9. Pass `showRetaste={true}` to `<TastingsSection>`:
   ```tsx
   <TastingsSection memberId={auth.user.id} displayName={displayName} showRetaste />
   ```

   **Checkpoint:** Navigate to `/you/tastings` — each tasting card now shows "Try again →".
   Navigate to another member's profile tastings tab — no "Try again →" shown (default false).

### Phase 3: Verify the link

10. Tap "Try again →" on a card with a release label → confirm the URL is
    `/products/{id}/recommend?release_label={encoded-label}` and the form pre-fills.

11. Tap "Try again →" on a card without a release label → confirm URL is
    `/products/{id}/recommend` (no query param).

## AI / Embedding Considerations
None. No AI calls, no embeddings.

## Design System Compliance
- No brass element added (link is a secondary text link, not a `<Button>`)
- Winston / `<Voice>` not used
- No etched dividers added
- `formatMemberName` not involved
- No flavor wheel exposure

## Mobile Constraints
- "Try again →" is a small secondary link, not a tap target competing with the main card link.
- The card still navigates to the product detail on tap anywhere except the "Try again →" link.
- One-handed reachability: the link sits in the info strip at the bottom of the card — reachable.

## Database / RLS
None.

## Testing
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] "Try again →" appears on every tasting card in `/you/tastings`
- [ ] "Try again →" does NOT appear in the main feed or other member profiles
- [ ] Tapping "Try again →" on a card with `release_label = "2023 Fall"` navigates to
      `/products/{id}/recommend?release_label=2023+Fall` (or URL-encoded equivalent)
- [ ] Tapping the card photo/name still navigates to product detail (outer Link works)
- [ ] Mobile viewport: link visible and tappable on iPhone-width screen

## Dependencies
None. This is self-contained.

## Estimated Total: 20 minutes
