# NCCC — Working Conventions

The Norton Commons Cigar Club app. Private PWA for 12 friends. Built with Next.js 16, Supabase, Tailwind v4, TypeScript.

This file is read by both Codex and Cursor when working in this repo.

## What this app is

A private iPhone-first PWA. Members snap photos of cigars/bourbons, tap **Recommend to NCCC**, and the group's collective voice surfaces on every product. A rules-based pairing engine suggests what to try next. Read `planning/nccc-spec.md` for the full concept.

## Core artifacts (the source of truth)

- **`docs/design-system.md`** — visual identity, type, palette, components, Winston voice rules. Honor it.
- **`data/flavor-wheels/`** — versioned cigar + bourbon flavor wheels (JSON). Schema documented inline.
- **`planning/nccc-spec.md`** — product spec.
- **`planning/nccc-implementation-plan.md`** — phased build plan. Current state: Phase 0.

## Code conventions

- **TypeScript strict.** Self-documenting names + types are preferred over comments. Comments only where the WHY is non-obvious.
- **Server-first.** Default to Server Components and Server Actions; reach for `"use client"` only when interactivity demands it (forms, photo capture, optimistic UI).
- **Identity:** member display is ALWAYS `formatMemberName(user)` → `"First L"`. Single source: `lib/identity/`. The two-Paul case is real; respect it.
- **Flavor wheel:** never rendered as sliders to users. Aggregate tag clouds only. The wheel is silent infrastructure.
- **Brass = the single primary action per screen.** No other element gets accent color. Ember is for lit recommend icons only. Moss is for club-validated pairings only.
- **Etched dividers** at every major section break. Use `<Divider label="THE CLUB SAYS" />`.
- **Winston** (the unicorn mascot — narrator of the club) speaks in italic Playfair via `<Voice />`. He appears at empty states, recommendation intros, first-run onboarding, and system messages. Never on capture, feed, or product-detail.
- **Imports:** absolute via `@/` alias. Type imports must use `import type`.
- **Forms:** Server Actions + `useActionState`. No form libraries.
- **State:** server state via Supabase + RSC. No Redux, Zustand, or context for anything Supabase can answer.

## Stack pinned choices

- Next.js 16 (App Router, RSC, Server Actions, async `cookies()`)
- Tailwind CSS v4 (CSS-first config via `@theme` in `globals.css`)
- Supabase (auth, postgres, pgvector, storage) via `@supabase/ssr`
- OpenAI: `gpt-5-mini` (vision + pairing prose), `gpt-5-nano` (chip→wheel mapping)
- Replicate CLIP for image embeddings
- Vitest (unit), Playwright (E2E, later), MSW (API mocking)
- Biome (lint + format) — no ESLint, no Prettier

## Layout

```
apps/web/src/
  app/              App Router routes
    (auth)/         /login, /accept-invite (auth group)
    auth/callback/  magic link exchange
  components/
    primitives/     Button, Card, Chip, Divider, MemberTag, Voice
  lib/
    identity/       formatMemberName + tests
    supabase/       server, client, middleware, admin
    utils.ts        cn()
  middleware.ts     session refresh
  styles → globals.css
```

## What to avoid

- Adding star ratings, 1–100 scores, or sliders in the user-facing UI.
- Public profiles, follower counts, public feeds. NCCC is private.
- Comments that restate the code. If a name is unclear, rename it.
- Defensive code for impossible states. Trust internal invariants; validate at boundaries.
- Backwards-compat shims or feature flags for code that has no real users yet.

## Testing posture

- `lib/` is exhaustively unit-tested (pure functions, especially pairing rules later).
- UI components: golden-path E2E only.
- Mock OpenAI/Replicate with MSW. Real-API integration tests are opt-in via `pnpm test:integration` (not yet wired).

## Environment

- Local: `cp apps/web/.env.example apps/web/.env.local`, fill in keys, `pnpm dev`.
- Production: env vars set in Vercel dashboard.
- Supabase migrations applied via `supabase db push` (manual).

## When in doubt

Read the design system, then the spec, then the plan. If still unclear, ask Paul. Don't invent features.
