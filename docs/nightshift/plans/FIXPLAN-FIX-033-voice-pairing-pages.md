# Fix: [FIX-033] `<Voice />` on Pairing Capture and Pairing Taste Pages

## Problem

Two more pages use `<Voice />` for instructional text in capture/form contexts — the
same design system violation as FIX-028 (which covered `capture/capture-form.tsx` and
`pairing-capture-flow.tsx`). These sites were not included in FIX-028's plan.

Members see Winston's italic Playfair prose used as instructional UI copy ("One photo of
the pair — I'll name the cigar and the pour." / "One photo of the pair — then tell us
how it sat."), which dilutes the brand meaning of Winston's voice and contradicts the
design system rule: **Winston never appears on capture pages or forms**.

## Root Cause

- `pairings/capture/page.tsx` line 40–42: page-level `<Voice>` above `PairingCaptureFlow`.
  Note: FIX-028 covered `pairing-capture-flow.tsx` (the component at line ~223), but not
  this page-level instance.
- `pairings/[cigarId]/[bourbonId]/taste/page.tsx` line 64: `<Voice>` intro on the pairing
  tasting form.

Both are "instructional UI hint" uses, not empty-states, recommendation intros, or system
messages.

## Steps

1. Open `apps/web/src/app/(app)/(shell)/pairings/capture/page.tsx`.

   Find lines 40–42:
   ```tsx
   <Voice className="mb-4 block text-sm">
     "One photo of the pair — I'll name the cigar and the pour."
   </Voice>
   ```
   Replace with:
   ```tsx
   <p className="mb-4 block text-sm text-center text-foreground-subtle italic font-serif">
     "One photo of the pair — I'll name the cigar and the pour."
   </p>
   ```
   Remove the `Voice` import if it is no longer used in this file after the change.

2. Open `apps/web/src/app/(app)/(shell)/pairings/[cigarId]/[bourbonId]/taste/page.tsx`.

   Find line 64:
   ```tsx
   <Voice className="mb-6">"One photo of the pair — then tell us how it sat."</Voice>
   ```
   Replace with:
   ```tsx
   <p className="mb-6 text-center text-sm text-foreground-subtle italic font-serif">
     "One photo of the pair — then tell us how it sat."
   </p>
   ```
   Remove the `Voice` import if it is no longer used in this file after the change.

3. Check whether `Voice` is still imported but now unused in each file; remove unused
   imports (Biome `noUnusedImports`).

4. Run `pnpm lint` to verify no Biome errors.

5. Run `pnpm build` to verify TypeScript passes.

## Files Modified

- `apps/web/src/app/(app)/(shell)/pairings/capture/page.tsx` — replace Voice with `<p>`,
  remove Voice import if unused
- `apps/web/src/app/(app)/(shell)/pairings/[cigarId]/[bourbonId]/taste/page.tsx` — replace
  Voice with `<p>`, remove Voice import if unused

## New Files

None.

## Database Changes

None.

## Verify

- [ ] Build passes
- [ ] Lint passes
- [ ] On `/pairings/capture`, the instructional text still renders in italic serif — visually
  identical but semantically correct
- [ ] On a pairing taste form (navigate to `/pairings/{cigarId}/{bourbonId}/taste`), the
  intro text renders in italic serif without the Voice wrapper
- [ ] Winston `<Voice>` component is not used anywhere on either page after the fix
