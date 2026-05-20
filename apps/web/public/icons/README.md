# NCCC Icon Set

## The one file that matters right now

Drop the source NCCC logo at:

```
apps/web/public/icons/nccc-logo.png
```

This is the single file the `<NCCCLogo />` React component reads from. Once it's in place, the logo shows up on login, reset-password, accept-invite, feed empty state, pairing intros, and anywhere else we call the component.

A square, transparent-background PNG at 512×512 is the right shape. Higher is fine — the component sizes down as needed.

## PWA-specific icon set (defer until launch prep)

Drop the following files here when we're ready to ship PWA-install polish:

| File | Size | Purpose |
|---|---|---|
| `icon-192.png` | 192×192 | PWA standard |
| `icon-512.png` | 512×512 | PWA standard |
| `icon-maskable-512.png` | 512×512 | Android adaptive icon (safe area in center 80%) |
| `apple-touch-icon.png` | 180×180 | iOS home-screen icon |

## Generation

Start from the source NCCC logo (the unicorn-in-smoking-jacket roundel). For the maskable variant, ensure the unicorn fits inside the inner 80% safe area — Android crops the outer ring on some launchers.

A quick way to generate the set once we have a high-res source:

```bash
npx pwa-asset-generator path/to/logo.png ./public/icons \
  --background "#15110C" \
  --padding "12%" \
  --opaque false \
  --type png \
  --manifest ../manifest.webmanifest
```
