# NCCC — Resume Prompt (Genesis)

Paste this as your first message in a new Claude session to pick up where we left off. Last updated **2026-05-21** (after the #5 trilogy + smoke-test fixes shipped).

---

## What NCCC is

A private iPhone-first PWA for the Norton Commons Cigar Club — 12 guys, monthly bourbon + cigar tastings. Members snap a photo of a band or label, the AI identifies it, they tap "Recommend to NCCC" with optional flavor chips and a note, the wheel mapper silently turns that into a vector, and the group's collective voice surfaces on every product. Rules-based pairing engine suggests what to try next.

**Working directory:** `/Volumes/Lexar/NCCC/`
**GitHub:** `https://github.com/nibblet/nccc` (private)
**Stack:** Next.js 16 + Supabase + Tailwind v4 + TypeScript + Biome + Vitest. OpenAI GPT-5 mini / nano.

---

## Read these before writing any code

In this order:

1. `CLAUDE.md` (repo root + `apps/web/CLAUDE.md`) — code conventions
2. `docs/design-system.md` — visual identity, brass/ember/moss rules, Winston voice
3. `planning/nccc-spec.md` — product spec (locked)
4. `planning/nccc-implementation-plan.md` — phased build plan (Phases 0–7 ✅ shipped)
5. `planning/nccc-roadmap.md` — post-launch ideas, prioritized in tiers
6. `data/flavor-wheels/wheel-schema.md` — wheel structure + v0.1-syn2 synonym evolution log

When in doubt, **the design system overrides everything else.** Brass is the single primary action per screen, ember is for lit recommend only, moss is for club-validated only. Etched dividers at every section break. Winston speaks in italic Playfair via `<Voice />`.

---

## Current shipped state — `main` branch

**All phases of the implementation plan have shipped.** Recent UX pass also shipped:

| Layer | Status |
|---|---|
| Phase 0 — Foundation (auth, design tokens, primitives) | ✅ |
| Phase 1 — Catalog seeding (~2,020 cigars + ~1,400 bourbons w/ wheel vectors) | ✅ |
| Phase 2 — Capture & identify (GPT-5 mini vision + fuzzy match) | ✅ |
| Phase 3 — Tasting flow (recommend + chips + silent wheel mapper) | ✅ |
| Phase 4 — Group voice (recommend bar + member takes + tag cloud) | ✅ |
| Phase 5 — Feed / Members / Events + bottom nav | ✅ |
| Phase 6 — Pairing engine + Winston prose + dedicated screen | ✅ |
| Phase 7 — Settings + admin + recap card + logo + cigar seeding | ✅ |
| UX-1 — Feed photo-as-card redesign | ✅ |
| UX-2 — Bottom nav with center brass Capture FAB | ✅ |
| UX-3 — Product detail deep-dive (typographic cloud + Construction panel + Facts strip) | ✅ |
| UX-5 (partial) — Settings hero-first + theme toggle + Meetups placement | ✅ |
| Wheel v0.1-syn1 + v0.1-syn2 synonym expansion | ✅ |
| Dedupe + repair (bourbons cross-source) | ✅ |
| Smoke-test fixes — pairings empty state, product-vector aggregation, dedupe pagination | ✅ |
| Tier 2 #5 — Tasting + Pairing Preferences (member_preferences + Settings UI + derive/match lib) | ✅ |
| Tier 2 #5a — FOR YOU match badge on Feed cards | ✅ |
| Tier 2 #5b — Tabbed Feed (For You / Cigars / Bourbons; Favorites deferred) | ✅ |

**151/151 unit tests passing on main.** Typecheck + lint + build all green.

---

## What's left (in priority order)

### Pre-launch
- [x] Smoke-test the post-fix feed/pairings/settings in browser — completed 2026-05-21
- [ ] Send first invite to a real member, verify the onboarding round-trip

### Now-shipped (was the planned #5 trilogy)
The trilogy landed in three commits on 2026-05-21: `c6a5dcc` (#5), `84bf5f5`
(#5a), `91e67f9` (#5b). Decisions that locked along the way:
- Bourbon styles derived from `whiskey_type` + `mash_bill` (covers the full ~2,000 catalog, not just the 101-row Cobb subset that has `style_family`).
- Cigar wrappers grouped into 8 buckets (collapsed from ~20 raw values).
- Proof band as 3 multi-select chips (≤90 / 90–110 / ≥110), not a slider.
- Match semantic: binary OR across all four axes. Self-skip on Feed.
- Favorites tab deferred to land alongside Tier 3 #9.

### Next build target
With the #5 trilogy shipped, the natural next move is one of:
- **Tier 1 #1 — The Cellar** on `/members/[id]` profile as a tab. Big surface, blocks #5b Favorites + #9 You-page expansion.
- **Tier 1 #2 — The Session** (restructure tasting flow into First/Second/Final Third for cigars, Nose/Palate/Finish for bourbons). Touches capture + product-detail.
- **Tier 1 #3 — Daily Pour** (home hero with rotating Winston suggestion). Smaller, would surface preferences immediately.

Ask Paul which one to tackle first.

### Other Tier 1 / 2 items, in roughly this order after the above
- **Tier 2 #4 — Depth view with radar chart** (the "open the depth" affordance already scaffolded in UX-3)
- **Tier 3 #15 — Member achievement badges** (First Light, First Pour, etc. — derived from existing tastings/events data)
- **Tier 3 #12 — Hand-curated cigar editorial baseline.** Smoke-test audit found 13 missing club staples (Padron 1964/1926/Family Reserve, Liga Privada No. 9/T52, Le Bijou 1922, Davidoff Nicaragua, Tatuaje Black, Oliva Melanio, La Aroma de Cuba Mi Amor, Aging Room Quattro, Diesel Whiskey Row, Ashton VSG) — concrete starting list logged inline in the roadmap.

### Remaining UX pass
- **UX-4 — Capture flow wow factor** (animated sepia develop transition, tactile press-and-hold chips, optional haptic). Last UX item.

### Open chips (separate sessions)
- **Jefferson's apostrophe damage in catalog.** Spawned as its own task before the #5 trilogy started. Likely lives in a bourbon-parser or seed normalization step; check whether it has been picked up before chasing it again.

See `planning/nccc-roadmap.md` for full scope on each.

---

## Recent decisions (locked, do not relitigate)

- **Wheel version stays at 0.1.** Synonyms are additive metadata; freshness stamped via `updated` field (`2026-05-20-syn2` is current). Bump to `0.2` only when leaves change meaning or new leaves are added.
- **"Line-level is fine" for batch collapsing.** Elijah Craig Barrel Proof batches merge into one product. Same for Larceny BP batches, Bardstown Fusion #s, Maker's Mark FAE variants.
- **Cross-line stays distinct.** Rye expressions vs. bourbon expressions of the same brand are separate products. Sub-line projects (Maltster, Single Oak Project, etc.) are separate.
- **Preferences are positive-only.** No "things to avoid" — Winston suggests *toward* taste. (Locked in #5 schema; the `member_preferences` table has no avoid columns.)
- **FOR YOU pill is top-LEFT on photo-as-card surfaces** (#5a). The ember dot owns top-right; the two never collide.
- **Tabbed Feed is URL-driven** (`?tab=cigars` etc.), not client-state. Lets bookmarks and back/forward work.
- **Product-level trait_vector aggregation only fills products that lack a trait_vector.** Curated seed signal is never overwritten by one or two member tastings. Drafts + seed gaps auto-fill from chip-mapped tasting vectors; seeded products stay as-is.
- **Bourbon dedupe paginates explicitly.** Supabase's silent 1000-row clamp was masking half the catalog from comparison. Don't remove the pagination loop.
- **Cellar lives on member profiles, not its own nav tab.** Inventory is identity; nav stays at 4 + FAB.
- **Theme toggle persists to localStorage.** "Auto" leaves both `html.dark` / `html.light` off, lets `@media (prefers-color-scheme)` decide.
- **Logo on dark mode** uses `filter: invert(1); mix-blend-mode: screen` via `.nccc-logo-mark` class. White-bg PNG renders as white-ink-on-transparent in dark mode.
- **Pairing engine recomputes on demand** when cache is stale; `/pairings` page computes member-specific pairings live (don't trust cache-only reads).

---

## Working conventions

### Commit format
- Title: short imperative ("UX-2: bottom nav with center FAB + Pairings tab"). Reference the roadmap item / phase / pass when applicable.
- Body: structured. **What changed** (components / files) → **Why** (link to user feedback or roadmap) → **Edge cases handled** → **Test count delta**.
- Always end with: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

### Gauntlet (before every commit)
```bash
cd apps/web
pnpm typecheck && pnpm test && pnpm lint && pnpm build
```
Or as a one-liner: `pnpm typecheck 2>&1 | tail -3 && pnpm test 2>&1 | tail -6 && pnpm lint:fix 2>&1 | tail -3 && pnpm lint 2>&1 | tail -3 && pnpm build 2>&1 | tail -8`

If lint complains about `useSemanticElements` on a div-with-role group, add a targeted `// biome-ignore lint/a11y/useSemanticElements: <reason>` — `<fieldset>` is for form controls and over-broad for visual toggle groups.

### Code style
- TypeScript strict. Self-documenting names + types over comments. Comments only when WHY is non-obvious.
- Server Components by default; `"use client"` only for interactivity (forms, photo capture, toggles, FAB nav).
- Forms: Server Actions + `useActionState`. No form libraries.
- State: Supabase + RSC. No Redux, Zustand, or context for anything the DB can answer.
- Identity ALWAYS via `formatMemberName(user) → "Paul C"`. Single source: `lib/identity/`.
- Flavor wheel: never rendered as sliders to users. Aggregate tag clouds only.
- Imports: absolute via `@/`. Type imports must use `import type`.
- No new comments inside JSX trees unless the structure is non-obvious. Trust the names.

### Anti-patterns to avoid
- Adding star ratings, 1–100 scores, or sliders in user-facing UI.
- Public profiles, follower counts, public feeds.
- Comments that restate the code.
- Defensive code for impossible states.
- Backwards-compat shims or feature flags for code that has no real users yet.
- Inventing features not in the plan/roadmap without asking.

### Photo-as-card primitive (UX-1)
The pattern was established for Feed and inherited by Product Detail (UX-3). When building new product-rendering surfaces (Cellar tab, catalog browse tabs in #5b):

- Use `<PhotoFrame src={signedUrl} alt={name}>{overlays}</PhotoFrame>` for member-contributed photos
- Use `<PhotoPlaceholder productType={type}>{overlays}</PhotoPlaceholder>` for catalog rows without photos
- Both accept an overlay-slot children prop for member-tag / chips / ember dot composition
- Standard aspect ratio: 4:5 (Polaroid-ish, editorial)

### Winston voice rules
- Italic Playfair via `<Voice />` component
- Appears at: empty states, recommendation intros, system messages, end-of-night recap
- Does NOT appear on: capture screen, feed cards directly, product detail face (it intros via composeIntro pattern)
- 1–2 sentences max. Refined, dry, slightly archaic. Never modern startup-speak.
- He calls the user "sir" or by first name. Never "user".

---

## Useful scripts

All in `apps/web/`:

```bash
pnpm dev                          # local dev server

# Catalog seeding
pnpm seed:wheels                  # load wheel JSONs into DB
pnpm seed:bourbons                # ~1,350 bourbons w/ v0.1-syn2 synonyms
pnpm seed:cigars-json             # ~2,020 cigars from StickPicks JSON
pnpm seed:cobb-whiskey            # 98 bottles from Paul's xlsx (gitignored)
pnpm seed:cigars                  # Halfwheel RSS (slow, LLM-per-item)
pnpm seed:cigars-api              # cigar-api.com via RapidAPI (currently 503)
pnpm seed:cigars-cigarbase        # CigarBase via RapidAPI (needs subscription)

# Maintenance
pnpm dedupe:bourbons --dry-run    # preview cross-source dupe merges
pnpm dedupe:bourbons              # apply (irreversible)
pnpm repair:after-dedupe --dry-run / live   # post-dedupe cleanup

# Admin
pnpm admin:set-password <email> <password> [first] [last_initial]
```

### Supabase
- Project ID: `jafcwggqgqxrcbuxjreo`
- Env vars in `apps/web/.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `RAPIDAPI_KEY`
- Migrations in `supabase/migrations/` — apply with `supabase db push`
- Email templates in the Supabase dashboard need `{{ .ConfirmationURL }}` (uses passed `redirectTo`), not hard-coded URLs. NCCC URL must be in **Authentication → URL Configuration → Additional Redirect URLs**.

### Theme toggle
- Stored at localStorage key `nccc-theme`: `light` | `dark` | `auto`
- `ThemeInitScript` in `src/app/layout.tsx <head>` applies the class pre-paint
- `ThemeToggle` client component lives at `src/components/theme/theme-toggle.tsx`

---

## How I prefer to work (Paul → Claude)

- **Ask 2–4 clarifying questions** when scope is ambiguous, using the `AskUserQuestion` tool. Don't ask one at a time over many turns.
- **Use TodoWrite proactively** for any task with 3+ distinct steps.
- **Lean on subagents** for research (Explore agent for codebase, general-purpose for web). Don't do open-ended research in the main context — it bloats.
- **Surface risks and trade-offs** in writing before applying anything irreversible (deletes, merges, schema changes). Provide `--dry-run` modes when destructive.
- **Tell me what's wrong, not what's right.** I want to know what broke or what's risky, not a checklist of green ticks.
- **Code → Verify gauntlet → Commit + push** in one turn whenever the diff is coherent. Don't sit on uncommitted work between turns.
- **Commit message bodies are documentation.** Future-me will read these. Write them like change-log entries.

---

## A typical resumption flow

1. Read CLAUDE.md, design-system.md, roadmap.md (skim — they're up to date)
2. `git log --oneline -10` to see recent work
3. `pnpm test` to confirm 120/120 still passing
4. Ask Paul: "Resuming from `main` at <last commit>. The natural next move is #5 → #5a → #5b. Want me to start, or different focus?"
5. Build with the gauntlet in the loop, commit when coherent.

---

## What's in the working tree right now (uncommitted-state hygiene)

`git status` should be clean. If it isn't:
- `git diff --stat` to see what's outstanding
- Check whether it's intentional (a draft) or stale (forgot to commit) before doing anything new

---

## Open questions / undecided

- **Education library authorship** (Tier 3 #14) — Paul writes? gpt-5-mini drafts? Defer until that tier comes up.
- **Cigar editorial baseline** (Tier 3 #12) — which ~100–150 to hand-curate? Paul to provide list.
- **Pairing screen redesign** (Tier 3 #8) — Cigarbase pairings screenshot still pending from Paul.
- **Real-art Winston illustrations** (Tier 3 #10) — Paul commissions or AI-generates? Currently using the one logo for all surfaces.

---

*Paste this prompt as the first message of a fresh Claude session. Read the listed files, run the gauntlet, then ask what to build.*
