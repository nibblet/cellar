# Fix: [FIX-008] Maker page `house_style` uses reserved moss color

## Problem
`makers/[slug]/page.tsx` renders the AI-derived `house_style` line in `text-moss-500`. Per the
NCCC design system, moss is reserved for "the club has tested this" pairing validation signals.
Using it for an AI-inferred flavor summary of a maker creates a false implication that the
house_style is club-validated content.

Members who understand the color system will see the green house_style text and think it indicates
club validation, when it actually just describes the maker's aggregate flavor profile from product
data.

## Root Cause
`apps/web/src/app/(app)/(shell)/makers/[slug]/page.tsx` line 61:

```tsx
<p className="text-[11px] uppercase tracking-widest text-moss-500 mt-2">
  {maker.house_style}
</p>
```

The class `text-moss-500` was likely copy-pasted from other "Club staple" / "club tried" labels
that are legitimately moss-colored, but this element is AI content, not club validation.

## Steps
1. Open `apps/web/src/app/(app)/(shell)/makers/[slug]/page.tsx`
2. Change the house_style paragraph from `text-moss-500` to `text-foreground-subtle`:

   **Before:**
   ```tsx
   {maker.house_style ? (
     <p className="text-[11px] uppercase tracking-widest text-moss-500 mt-2">
       {maker.house_style}
     </p>
   ) : null}
   ```

   **After:**
   ```tsx
   {maker.house_style ? (
     <p className="text-[11px] uppercase tracking-widest text-foreground-subtle mt-2">
       {maker.house_style}
     </p>
   ) : null}
   ```

3. Run `pnpm build` to confirm no errors
4. Run `pnpm lint`
5. Manual: visit any maker page that has a `house_style` value and confirm the text is now muted,
   not green

## Files Modified
- `apps/web/src/app/(app)/(shell)/makers/[slug]/page.tsx` — swap moss to foreground-subtle for house_style

## Verify
- [ ] `pnpm build` passes
- [ ] House_style text on maker page renders in muted foreground color, not green
- [ ] Validated pairing indicators (moss) elsewhere on the page are unaffected
