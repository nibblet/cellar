# Fix: [FIX-022] Moss Color in Settings Form Success States

## Problem
Four member-facing settings forms use `text-moss-600` as a success feedback color. Design system
reserves `text-moss-*` exclusively for "club has tested this pairing" validation signals (same
rule as FIX-019, which covers the 5 most impactful sites). Members will never confuse a settings
form confirmation with a pairing signal, but the semantic inconsistency accumulates as moss color
loses meaning.

These are NOT the same 5 files tracked in FIX-019; those cover product detail, photo manager,
edit form, maker admin actions, and meetup form.

## Root Cause
Four settings/feedback forms adopted moss as a generic "green = success" color:
- `apps/web/src/app/(app)/(shell)/you/settings/avatar-uploader.tsx` line 50
- `apps/web/src/app/(app)/(shell)/you/settings/display-name-form.tsx` line 48
- `apps/web/src/app/(app)/(shell)/settings/preferences-form.tsx` line 116
- `apps/web/src/app/(app)/(shell)/roadmap/suggestion-form.tsx` line 69

## Steps

1. **`you/settings/avatar-uploader.tsx` line 50**

   Before:
   ```tsx
   <span className={state.ok ? "text-sm text-moss-600" : "text-sm text-ember-500"}>
   ```
   After:
   ```tsx
   <span className={state.ok ? "text-sm text-foreground-muted" : "text-sm text-ember-500"}>
   ```

2. **`you/settings/display-name-form.tsx` line 48**

   Before:
   ```tsx
   <span className={state.ok ? "text-sm text-moss-600" : "text-sm text-ember-500"}>
   ```
   After:
   ```tsx
   <span className={state.ok ? "text-sm text-foreground-muted" : "text-sm text-ember-500"}>
   ```

3. **`settings/preferences-form.tsx` line 116**

   Before:
   ```tsx
   className={state.ok ? "text-sm text-moss-600" : "text-sm text-foreground-subtle"}
   ```
   After:
   ```tsx
   className={state.ok ? "text-sm text-foreground-muted" : "text-sm text-foreground-subtle"}
   ```

4. **`roadmap/suggestion-form.tsx` line 69**

   Before:
   ```tsx
   <p className="text-sm text-moss-600">Thanks — Paul will see this.</p>
   ```
   After:
   ```tsx
   <p className="text-sm text-foreground-muted">Thanks — Paul will see this.</p>
   ```

5. Run `pnpm build`.
6. Run `pnpm lint`.

## Files Modified
- `apps/web/src/app/(app)/(shell)/you/settings/avatar-uploader.tsx`
- `apps/web/src/app/(app)/(shell)/you/settings/display-name-form.tsx`
- `apps/web/src/app/(app)/(shell)/settings/preferences-form.tsx`
- `apps/web/src/app/(app)/(shell)/roadmap/suggestion-form.tsx`

## Verify
- [ ] Build passes
- [ ] Lint passes
- [ ] Visually confirm: success messages still legible (foreground-muted is appropriate contrast)
- [ ] Confirm FIX-019 separately covers the other 5 files (no overlap)
