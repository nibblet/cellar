# Fix: [FIX-028] `<Voice />` used on capture form and pairing capture flow

## Problem
The `<Voice />` component (Winston's italic Playfair prose) appears twice on the capture
form and once in the pairing capture flow as instructional hints shown to members during
photo capture. The design system is explicit: **Winston never appears on the capture page.**
His allowed contexts are: empty states, recommendation intros, first-run onboarding, and
system messages.

Using `<Voice />` for "Hold the band steady. I'll do the rest." turns a purely action-
oriented screen (camera → identify) into a narrated experience. It also dilutes the
Voice component's impact in contexts where it's semantically meaningful (cellar empty
states, Try Next rationales, pairing prose).

## Root Cause

**`apps/web/src/app/(app)/(shell)/capture/capture-form.tsx`**

- **Line 68–70** (`mode === "both"` path):
  ```tsx
  <Voice className="text-center mb-2">
    One photo of the pair — I'll name the cigar and the pour.
  </Voice>
  ```
- **Line 96** (single-product path):
  ```tsx
  <Voice className="text-center mb-2">{voiceLine}</Voice>
  ```
  where `voiceLine` is `"Hold the band steady. I'll do the rest."` or
  `"Hold the label steady. I'll do the rest."` depending on mode.

**`apps/web/src/components/pairing/pairing-capture-flow.tsx`**
- **~Line 223**: `<Voice>` used during the photo-identification loading step
  ("Reading the band and the label…" or similar). Also a capture-context violation.

## Steps

### 1. Fix `capture-form.tsx`

Open `apps/web/src/app/(app)/(shell)/capture/capture-form.tsx`.

**Line 68–70 — replace `<Voice>` with a plain subtitle:**
```tsx
// Before
<Voice className="text-center mb-2">
  One photo of the pair — I'll name the cigar and the pour.
</Voice>

// After
<p className="text-center text-sm text-foreground-subtle italic font-serif">
  One photo of the pair — I'll name the cigar and the pour.
</p>
```

**Line 96 — replace `<Voice>` with a plain subtitle:**
```tsx
// Before
<Voice className="text-center mb-2">{voiceLine}</Voice>

// After
<p className="text-center text-sm text-foreground-subtle italic font-serif">{voiceLine}</p>
```

Also check `CapturePendingState` (defined later in the same file, around line ~230–260).
If it contains any `<Voice>` usage for loading text, replace with the same `<p>` pattern.

### 2. Fix `pairing-capture-flow.tsx`

Open `apps/web/src/components/pairing/pairing-capture-flow.tsx`.

Find the `<Voice>` usage near line 223 (loading/identifying state). Replace with the same
`<p className="text-center text-sm text-foreground-subtle italic font-serif">` pattern.

### 3. Verify `Voice` import is still needed

After the replacements, check if `Voice` is still imported in both files. If the component
is no longer used in a file, remove the import to keep lint clean.

### 4. Build and lint
```
pnpm build
pnpm lint
```

## Files Modified
- `apps/web/src/app/(app)/(shell)/capture/capture-form.tsx` — 2 Voice→p replacements + possible import removal
- `apps/web/src/components/pairing/pairing-capture-flow.tsx` — 1 Voice→p replacement + possible import removal

## Verify
- [ ] Build passes
- [ ] Lint passes
- [ ] Capture page renders: instructional text still appears, no Winston italic prose styling difference is jarring (the `font-serif italic` class keeps it feeling intentional)
- [ ] Both single-product (`mode=cigar|bourbon`) and paired (`mode=both`) capture paths tested
- [ ] No `<Voice />` usage remains in `capture/` or `pairing-capture-flow.tsx`
