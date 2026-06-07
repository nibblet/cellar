# Fix: [FIX-024] UTC weekday in Tonight's Pick voice line

## Problem
Winston's Tonight's Pick voice line on the Cellar page reads "For a Wednesday on the porch" when
it's Tuesday evening in Louisville. After 8pm EDT (UTC-4) the UTC date has already rolled to the
next calendar day, so `getUTCDay()` returns the wrong weekday. Every member in the club is in the
Louisville, KY / Eastern time zone — they all see the mismatched day name during evening sessions,
which is exactly when the club meets.

Impact: cosmetic/flavor only; the pairing pick itself is unaffected. But a club that meets on
Tuesday nights seeing "For a Wednesday" is a jarring false note.

## Root Cause
`apps/web/src/app/(app)/(shell)/you/cellar/page.tsx`, `TonightsPickSection` function, line 85:

```typescript
const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const day = days[new Date().getUTCDay()];
```

This runs server-side. `new Date()` returns the current instant; `getUTCDay()` interprets it in UTC
rather than Eastern time. The `days` array and index math are fine — only the timezone is wrong.

Note: `todayKey()` in `lib/daily-pour/select.ts` deliberately uses UTC (documented at lines 39–46)
to keep the pick rotation consistent across timezones. That function is NOT changed by this fix.

## Steps
1. Open `apps/web/src/app/(app)/(shell)/you/cellar/page.tsx`
2. In `TonightsPickSection`, locate lines 84–86:
   ```typescript
   const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
   const day = days[new Date().getUTCDay()];
   ```
3. Replace those two lines with:
   ```typescript
   const day = new Date().toLocaleDateString("en-US", {
     weekday: "long",
     timeZone: "America/New_York",
   });
   ```
   `Intl.DateTimeFormat` is available in the Node.js runtime with no import needed.
4. Run `pnpm build` to verify no type errors.
5. Run `pnpm lint` (Biome) — no variables removed, only two lines swapped; expect clean.
6. Run `pnpm test` — no unit tests cover this server component; confirm nothing breaks.

## Files Modified
- `apps/web/src/app/(app)/(shell)/you/cellar/page.tsx` — Replace `days` array + `getUTCDay()` with
  a single `toLocaleDateString` call using `America/New_York`.

## New Files (if any)
None.

## Database Changes (if any)
None.

## Verify
- [ ] Build passes
- [ ] Lint passes
- [ ] Day name in Winston voice line matches Eastern weekday at any hour, including after 8pm EDT
- [ ] Pick rotation itself is unchanged (still driven by `todayKey()` → UTC date)
- [ ] No regressions on the Cellar page (TonightsPickSection renders a pairing link as before)
