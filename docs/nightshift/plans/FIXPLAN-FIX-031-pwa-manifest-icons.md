# Fix: [FIX-031] Missing PWA manifest icons

## Problem

`apps/web/public/manifest.webmanifest` references four icon files that do not exist:
- `/icons/icon-192.png`
- `/icons/icon-512.png`
- `/icons/icon-maskable-512.png`
- `/icons/apple-touch-icon.png`

Only `nccc-logo.png` currently lives in `apps/web/public/icons/`. Every page load generates four 404 errors in the browser network log. Chrome and Android will likely refuse to present the PWA install prompt or will show a broken/fallback icon. iOS Safari is more forgiving (falls back to the `apple` icon metadata in `layout.tsx` which points to `nccc-logo.png`), but the console noise is real.

The `apps/web/public/icons/README.md` documents this as a "defer until launch prep" placeholder — the intention is correct, but the manifest should reflect the current reality rather than a future state.

## Root Cause

`manifest.webmanifest` was written ahead of the icon assets. The `README.md` and `layout.tsx` both acknowledge the deferral. The gap is that the manifest currently causes 404 errors in production rather than gracefully omitting the missing sizes.

**Options:**
1. **Short-term (this fix):** Point all manifest icon entries at the existing `nccc-logo.png` for now. Browser sees a real file, no 404s, icons look correct (the logo is already 512×512). Sizes will be wrong (all report 512×512) but browsers tolerate this gracefully.
2. **Launch prep (later):** Generate the proper icon set per the `README.md` generation instructions and update the manifest back to the versioned entries.

This fix implements option 1.

## Steps

1. Open `apps/web/public/manifest.webmanifest`
2. Replace the `icons` array with entries that all reference the existing `nccc-logo.png`. Keep the `purpose` annotations correct — `any` for the main icon, `maskable` for the Android adaptive variant (the logo is centered on the dark background, which satisfies the 80% safe-area requirement):

```json
"icons": [
  {
    "src": "/icons/nccc-logo.png",
    "sizes": "192x192",
    "type": "image/png",
    "purpose": "any"
  },
  {
    "src": "/icons/nccc-logo.png",
    "sizes": "512x512",
    "type": "image/png",
    "purpose": "any maskable"
  }
]
```

3. Verify in the browser: open DevTools → Application → Manifest — no icon 404 errors should appear.
4. Run `pnpm lint` to confirm no linting issues (manifest is not linted by Biome but worth a clean run).
5. Run `pnpm build` to confirm no build errors.

## Files Modified

- `apps/web/public/manifest.webmanifest` — replace 4-entry icon array (with 404 paths) with 2-entry array using existing `nccc-logo.png`

## Database Changes

None.

## Verify

- [ ] Build passes
- [ ] Lint passes
- [ ] Open DevTools → Application → Manifest in Chrome — no 404 errors in console for icon paths
- [ ] PWA installability check (Chrome DevTools Lighthouse → PWA) shows no "icons missing" failure
- [ ] iOS Safari "Add to Home Screen" shows the NCCC logo (not a broken image)
- [ ] `apps/web/public/icons/README.md` note about launch-prep icon generation is unchanged (kept as documentation of what to do later)
