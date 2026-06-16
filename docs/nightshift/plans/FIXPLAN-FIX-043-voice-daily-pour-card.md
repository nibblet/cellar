# Fix: [FIX-043] `<Voice />` in DailyPourCard on main feed — design system clarification

## Problem
`DailyPourCard` renders `<Voice>` for Winston's pairing rationale at line 42–44 of
`apps/web/src/components/feed/daily-pour-card.tsx`. The Daily Pour card appears at the top of the
"For You" feed tab. The design system rule states: "Winston never on capture, feed, or
product-detail."

**Decision needed from Paul.** The Daily Pour card is the one feed element that is entirely
Winston's own pick — it is Winston speaking as the club's sommelier ("Tonight's pour from your
shelf is the Oliva Serie V with the Weller 12"). This is arguably a "recommendation intro," which
IS an allowed Winston context. The "Never on feed" rule may specifically mean "never on individual
member tasting cards," not the system-curated pick card.

If Paul confirms this Voice usage is intentional (recommendation intro on a system card), no code
change is needed — add a `biome-ignore` comment and a note in STATUS.md. If Paul wants
consistency (no Voice anywhere on the feed at all), replace with a plain `<p className="...
italic font-serif">` matching the visual style.

## Root Cause
`apps/web/src/components/feed/daily-pour-card.tsx` lines 42–44:
```tsx
<Voice className="block mt-2 mb-3">"{pour.rationale}"</Voice>
```

The `pour.rationale` is a short Winston-voice prose line computed by
`lib/pick-pour/select.ts` (deterministic template, no LLM cost). The card is mounted inside
`FeedList` in `app/(app)/(shell)/page.tsx`.

## Option A — Mark as intentional (recommended if Daily Pour is a "recommendation intro")
1. Open `apps/web/src/components/feed/daily-pour-card.tsx`
2. Add a comment on the Voice usage:
   ```tsx
   {/* Winston is allowed here: DailyPourCard is a system recommendation intro, not a member tasting card */}
   <Voice className="block mt-2 mb-3">"{pour.rationale}"</Voice>
   ```
3. Add to STATUS.md under Key Conventions: "DailyPourCard `<Voice>` is intentional — it is a
   system recommendation intro, the single exception to 'Never on feed'."
4. Run `pnpm lint`

## Option B — Remove Voice (strict design system compliance)
1. Open `apps/web/src/components/feed/daily-pour-card.tsx`
2. Replace lines 42–44:
   ```tsx
   // BEFORE
   <Voice className="block mt-2 mb-3">"{pour.rationale}"</Voice>
   // AFTER
   <p className="block mt-2 mb-3 italic font-serif text-foreground">"{pour.rationale}"</p>
   ```
3. Remove `Voice` from the import if no other usage in the file.
4. Run `pnpm lint` and `pnpm build`.

## Files Modified
- `apps/web/src/components/feed/daily-pour-card.tsx` — comment (Option A) or plain `<p>` replacement (Option B)

## Verify
- [ ] Daily Pour card still renders the rationale line in italic serif style
- [ ] Lint passes
- [ ] Build passes
- [ ] Decision documented in STATUS.md if Option A
