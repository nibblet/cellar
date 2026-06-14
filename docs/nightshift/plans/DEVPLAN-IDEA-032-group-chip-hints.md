# Dev Plan: [IDEA-032] Group chip hints on the recommend form

## What This Does
When a member opens the recommend form at `/products/[id]/recommend`, the chip picker currently shows the full flavor wheel as a flat list with no guidance on which flavors the club has found relevant for THIS product. Adding a `GroupChipHints` row above the picker — showing the top 4–5 chips from the product's existing `GroupVoice.tag_cloud` as tappable ghost chips — reduces "I don't know what to pick" friction, especially for newer members or less common products.

Tapping a hint chip pre-selects it in the chip picker's existing selection state. The recommend form's chip picker remains the single source of truth for selection. This is pure UX polish: zero AI cost, no DB changes, no new API calls — just piping already-computed data to a new surface.

## User Stories
- As a member recommending a bourbon my club has tried many times, I want to quickly confirm the flavors others have noted without scrolling the full wheel, so that my tasting record aligns with shared club vocabulary.
- As a newer member, I want to see "Others have noted: earthy, cedar, medium body" as tappable shortcuts so I don't stare at 60 chips wondering where to start.
- As Winston (the club voice), I want members' chip selections to converge on accurate vocabulary so that the aggregate tag cloud grows richer over time.

## Implementation

### Phase 1: Load GroupVoice in the recommend page server component
1. Open `apps/web/src/app/(app)/(shell)/products/[id]/recommend/page.tsx`
2. Import `loadGroupVoice` from `@/lib/aggregation/group-voice`
3. After the product query (around line 36), add:
   ```ts
   const groupVoice = await loadGroupVoice(supabase, product.id, product.type as ProductType);
   const topChips = groupVoice.tag_cloud.slice(0, 5).map((e) => e.label);
   ```
4. Pass `topChips` as a prop to `<RecommendForm ... topChips={topChips} />`
5. **Checkpoint:** TypeScript will error on the new prop until Phase 2.

### Phase 2: Add `topChips` prop to RecommendForm and build GroupChipHints
1. Open `apps/web/src/app/(app)/(shell)/products/[id]/recommend/recommend-form.tsx`
2. Add `topChips?: string[]` to the props type.
3. Create a new file: `apps/web/src/app/(app)/(shell)/products/[id]/recommend/group-chip-hints.tsx`
   ```tsx
   "use client";

   interface Props {
     hints: string[];
     onSelect: (label: string) => void;
     selectedChips: string[];
   }

   export function GroupChipHints({ hints, onSelect, selectedChips }: Props) {
     if (hints.length === 0) return null;
     return (
       <div className="mb-4">
         <p className="text-xs text-foreground-subtle uppercase tracking-widest mb-2">
           Others have noted
         </p>
         <div className="flex flex-wrap gap-2">
           {hints.map((label) => (
             <button
               key={label}
               type="button"
               onClick={() => onSelect(label)}
               className={cn(
                 "px-3 py-1.5 rounded-full text-sm border transition-colors",
                 selectedChips.includes(label)
                   ? "border-accent bg-accent/10 text-accent"
                   : "border-border text-foreground-subtle hover:border-accent/60 hover:text-foreground",
               )}
             >
               {label}
             </button>
           ))}
         </div>
       </div>
     );
   }
   ```
4. Import `cn` from `@/lib/utils` and `GroupChipHints` inside `recommend-form.tsx`.
5. In `recommend-form.tsx`, render `<GroupChipHints hints={topChips ?? []} onSelect={handleChipToggle} selectedChips={selectedChips} />` above the main chip picker section.
6. The `handleChipToggle` function already exists in the form — tapping a hint chip calls the same toggle function as clicking a wheel chip, so selection state is unified.
7. **Checkpoint:** `pnpm build` should pass; open `/products/[someId]/recommend` for a well-tasted product and confirm the hints row appears.

### Phase 3: Edge cases and polish
1. Hide `GroupChipHints` when `topChips` is empty (no prior tastings) — the `if (hints.length === 0) return null;` in the component already handles this.
2. Ensure a hint chip that is already selected renders in the "active" state (using `selectedChips.includes(label)` check).
3. If the product has no prior tastings at all (first log), `tag_cloud` will be empty and the hints row is silently absent — correct behavior.
4. Run `pnpm lint` — verify no unused imports.
5. **Checkpoint:** On a product with no prior tastings, the form looks identical to before. On a well-tasted product, the top 5 club chips appear as ghost shortcuts.

## AI / Embedding Considerations
- No AI calls. `tag_cloud` is already computed by `loadGroupVoice` (in-memory aggregation of fetched tasting rows).
- The extra `loadGroupVoice` call in the recommend page server component adds one DB query (~5–10ms). Acceptable — the product fetch was already there; this is one join on `tastings`.
- No MSW mocks needed; unit tests for `loadGroupVoice` already exist.

## Design System Compliance
- Single brass action confirmed — the primary "Recommend" submit button is unchanged; hint chips are ghost style.
- Winston not used — hints are a non-Winston UI element (plain label text, not `<Voice />`).
- Etched dividers not needed here — hints row is inline above the picker, no section break warranted.
- Flavor wheel: the hints surface `tag_cloud` labels (aggregate club vocabulary), not wheel internals — consistent with "aggregate tag clouds only" convention.
- `formatMemberName` not involved.

## Mobile Constraints
- Hint chips use `flex-wrap gap-2` — wraps gracefully on narrow screens.
- Touch targets: `px-3 py-1.5 rounded-full` gives adequate tap area (~36px tall).
- Appearing above the existing chip picker keeps it in the thumb zone.

## Database / RLS
No changes. `loadGroupVoice` reads from `tastings` with existing RLS (all authenticated members can read all tastings).

## Testing
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] Recommend page for a product with ≥2 prior tastings shows top-5 hint chips
- [ ] Tapping a hint chip selects it in the picker state (same as tapping the chip in the wheel)
- [ ] Tapping a pre-selected hint chip deselects it
- [ ] Recommend page for a product with 0 tastings shows no hints row
- [ ] Mobile viewport: hints row wraps cleanly, tap targets adequate

## Dependencies
None. `loadGroupVoice` and the recommend form are stable.

## Estimated Total: ~45 minutes
(Phase 1: 10 min, Phase 2: 25 min, Phase 3: 10 min)
