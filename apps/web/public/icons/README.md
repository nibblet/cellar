# NCCC Icon Set

Drop the following files here once we render them from the NCCC logo:

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
