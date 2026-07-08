# Evening Model — Build Plan

Branch: `feature/evening-model-remix`  
Spec: `docs/superpowers/specs/2026-07-07-evening-model-remix-design.md`

## Goal

Remix The Cellar IA for solo use: **Cellar · Shelf · Capture · Log · You**, demote Catalog/Pairings, paginate catalog images, and add daily freshness to Try/Hunt next.

## Phases (done on this branch)

1. **Nav + routes** — paths contract, bottom nav, legacy redirects, auth → `/`
2. **Shelf** — `/shelf` standalone Have/Want/Tried
3. **Log** — `/log` merged feed with filters
4. **You** — taste profile, stats, last session, browse links
5. **Catalog perf** — 36/page, thumbnail signing, makers default, lazy images
6. **Freshness** — Try next daily rotation, Hunt fresh-drops lane, Tonight shuffle
7. **Onboarding** — welcome NAV_MAP

## Verify

```bash
cd apps/web
pnpm test
pnpm typecheck
pnpm lint
```

Manual: Cellar home → Shelf → Log → You; `/pairings` → Log; catalog loads fast.
