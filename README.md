# NCCC

A private PWA for the Norton Commons Cigar Club.

Twelve guys, monthly bourbon and cigar tastings. The app exists to move good cigars and bourbons between members through shared discovery.

## Where things live

```
apps/web/                 Next.js 15 PWA (App Router, TypeScript, Tailwind)
data/flavor-wheels/       Versioned cigar + bourbon flavor wheels (JSON)
docs/design-system.md     Visual identity, type, components, Winston voice
planning/                 Spec + phased implementation plan
scripts/                  Seeding + ops scripts
supabase/migrations/      SQL migrations
```

## Quick start

```bash
cd apps/web
cp .env.example .env.local       # then fill in Supabase + OpenAI keys
pnpm install
pnpm dev
```

App runs at http://localhost:3000.

## Stack

- Next.js 15 (App Router, React Server Components)
- Supabase (Postgres + Auth + Storage + pgvector)
- Tailwind CSS + shadcn/ui primitives
- OpenAI GPT-5 mini (vision identification, pairing prose) + nano (chip→wheel mapping)
- Replicate CLIP for image embeddings
- Vitest (unit), Playwright (E2E), MSW (API mocking)
- Biome (lint + format)

## Conventions

See `CLAUDE.md` for the conventions both human and AI contributors follow.

## License

Private. For NCCC members.
