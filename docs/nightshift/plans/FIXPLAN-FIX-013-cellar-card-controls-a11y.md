# Fix: [FIX-013] a11y/useSemanticElements — role="group" div in cellar-card-controls.tsx

## Problem
`apps/web/src/components/cellar/cellar-card-controls.tsx` line 39 uses a `<div role="group">`
wrapping icon `<button>` elements. Biome's `lint/a11y/useSemanticElements` rule (error)
suggests replacing the div with `<fieldset>`. However, `<fieldset>` is semantically
correct only for grouping form inputs (`<input>`, `<select>`, `<textarea>`) — not for
a group of icon buttons that control cellar state. Changing to `<fieldset>` would require
a `<legend>` child and would add unwanted default border/margin styling.

The correct fix is to preserve `role="group"` on the div and suppress the lint error
with an explanatory comment.

## Root Cause
Biome `useSemanticElements` maps `role="group"` → suggest `<fieldset>` without
considering that `<fieldset>` is for form controls, not action button groups.
The ARIA spec allows `role="group"` on any element when grouping related interactive
content; `<fieldset>` is merely the preferred choice when those controls are form
fields.

## Steps
1. Open `apps/web/src/components/cellar/cellar-card-controls.tsx`
2. At line 38, add a biome-ignore comment immediately before the `<div`:
   ```tsx
   {/* biome-ignore lint/a11y/useSemanticElements: groups icon buttons, not form inputs; <fieldset> requires a <legend> and assumes form controls */}
   <div
     className="flex items-center gap-1.5 px-2 py-1.5 rounded-full bg-ink-900/40 border border-paper-50/30 backdrop-blur-[2px]"
     onClick={(e) => e.preventDefault()}
     onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
     role="group"
     aria-label="Cellar status"
   >
   ```
3. Run `pnpm lint` — `useSemanticElements` error for this file should be gone.

## Files Modified
- `apps/web/src/components/cellar/cellar-card-controls.tsx` — add biome-ignore comment

## Verify
- [ ] `pnpm lint` passes for `cellar-card-controls.tsx`
- [ ] No visual regression on catalog card cellar controls
