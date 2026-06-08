# Fix: [FIX-025] UTC date in FeedList `today` causes meetup events to flip prematurely

## Problem
After 8pm EDT (UTC-4), `today` in the feed page becomes the next UTC calendar day. A Monday
evening club meetup that runs from 7–10pm would flip from "upcoming" to "past" at 8pm EDT — while
members are still actively on the porch. The MeetupCard shows "Last meetup" instead of "Upcoming
meetup" for the remaining two hours of the event. Same symptom affects the planned IDEA-014
meetup-tonight banner (which checks `upcoming.date === today`).

## Root Cause
`apps/web/src/app/(app)/(shell)/page.tsx` line 290:

```typescript
const today = new Date().toISOString().slice(0, 10);
```

`toISOString()` returns UTC. After midnight UTC (8pm EDT), the slice gives tomorrow's date.
The two event queries that use `today` (`.gte("date", today)` and `.lt("date", today)`) both flip
one day early from the club's perspective. Same class as FIX-024 (cellar page UTC weekday, now planned).

## Steps
1. Open `apps/web/src/app/(app)/(shell)/page.tsx`
2. Replace line 290:
   ```typescript
   // Before
   const today = new Date().toISOString().slice(0, 10);

   // After — en-CA locale naturally produces YYYY-MM-DD in America/New_York
   const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
   ```
3. No other changes needed — `today` is used only in the two `events` queries (lines 297 and 303).
4. Run `pnpm build` to verify
5. Run `pnpm lint`
6. Test: Check the app at 8:05pm EDT on a day with a meetup event in the DB — confirm the MeetupCard
   still shows "Upcoming" rather than "Last meetup."

## Files Modified
- `apps/web/src/app/(app)/(shell)/page.tsx` line 290 — replace UTC slice with ET locale date string

## New Files (if any)
None.

## Database Changes (if any)
None.

## Verify
- [ ] Build passes
- [ ] Lint passes
- [ ] `today` equals the correct YYYY-MM-DD in ET for the current moment
- [ ] Meetup with today's date appears in `upcoming`, not `last`, at 8–11pm EDT
- [ ] IDEA-014 devplan note updated: use same `en-CA` ET pattern for `isTonightMeetup`
