# Fix: [FIX-042] Duplicate `<Divider label="The archive" />` on tastings history page

## Problem
The `/you/tastings` page renders **two consecutive** "THE ARCHIVE" etched dividers with nothing
between them. Members see a doubled header line, looking like a layout bug.

**Impact on members:** Immediately visible, cosmetically broken. Any member with any tastings will
see the doubled divider on their tastings history page.

## Root Cause
Both the page shell and the section component render the same divider:

1. `apps/web/src/app/(app)/(shell)/you/tastings/page.tsx` **line 30** renders `<Divider label="The archive" />`
2. `apps/web/src/components/members/sections/tastings-section.tsx` **line 33** renders `<Divider label="The archive" />` again

The divider belongs in the section component (which also renders an empty-state or the list),
not in the page shell. The page shell's Divider was added redundantly.

## Steps
1. Open `apps/web/src/app/(app)/(shell)/you/tastings/page.tsx`
2. Remove line 30 (`<Divider label="The archive" />`):
   ```tsx
   // BEFORE
   <Divider label="The archive" />

   <TastingsSection memberId={auth.user.id} displayName={displayName} />

   // AFTER
   <TastingsSection memberId={auth.user.id} displayName={displayName} />
   ```
3. If the `Divider` import on line 4 is now unused (check — it is no longer used after removing line 30), remove it:
   ```tsx
   // BEFORE
   import { Divider } from "@/components/primitives";
   // AFTER — remove entirely if no other Divider usage in the file
   ```
4. Run `pnpm lint`
5. Run `pnpm build`
6. Test: navigate to `/you/tastings` — confirm only one "THE ARCHIVE" divider appears

## Files Modified
- `apps/web/src/app/(app)/(shell)/you/tastings/page.tsx` — remove duplicate Divider (line 30) and its import

## Verify
- [ ] Build passes
- [ ] Lint passes
- [ ] Only one "THE ARCHIVE" divider renders on `/you/tastings`
- [ ] Member profile page at `/members/[id]` (which uses the same `TastingsSection`) is also unaffected — it does NOT have a page-level Divider before the section, so the fix is contained
