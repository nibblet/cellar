# Fix: [FIX-014] a11y/useSemanticElements — role="group" div in tasting-action-segment.tsx

## Problem
`apps/web/src/components/product/tasting-action-segment.tsx` line 22 uses
`<div role="group">` wrapping two `<Link>` elements (navigation, not form inputs).
Biome's `lint/a11y/useSemanticElements` rule (error) suggests replacing with `<fieldset>`.
`<fieldset>` is wrong here: it's for form controls, not navigation links. The two links
are visually styled as a segmented brass control but they navigate, they don't submit
a form.

The correct semantic element for a group of navigation links is `<nav>`, but changing
from a `role="group"` div to `<nav>` would change the ARIA semantics (landmark region
vs. generic group), which could affect screen reader announces. The intent here is a
single atomic control group, not a full navigation landmark. The safest fix is a
biome-ignore with explanation.

## Root Cause
Same Biome `useSemanticElements` rule over-generalization as FIX-013. `role="group"`
is valid ARIA for grouping related interactive elements regardless of element type.

## Steps
1. Open `apps/web/src/components/product/tasting-action-segment.tsx`
2. Add a biome-ignore comment on the line immediately before the `<div` at line 22:
   ```tsx
   {/* biome-ignore lint/a11y/useSemanticElements: groups navigation links as a segmented control; <fieldset> requires form inputs and <legend> */}
   <div
     className="grid grid-cols-2 rounded-[12px] border border-accent overflow-hidden bg-accent"
     role="group"
     aria-label="Tasting actions"
   >
   ```
3. Run `pnpm lint` — `useSemanticElements` error for this file should be gone.

## Files Modified
- `apps/web/src/components/product/tasting-action-segment.tsx` — add biome-ignore comment

## Verify
- [ ] `pnpm lint` passes for `tasting-action-segment.tsx`
- [ ] Product detail tasting action segment renders correctly
