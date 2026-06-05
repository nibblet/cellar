# Dev Plan: [IDEA-014] Meetup Tonight Banner on Feed

## What This Does
When a meetup event in the `events` table falls on today's date, the feed's "For You" tab shows
a special Winston `<Voice />` banner above the regular `MeetupCard`. The banner says something
like *"Tonight's the night — pour something and tap the group in."* with a brass CTA button
linking to `/pairings/capture`. This feeds the feedback loop by surfacing "tonight is a meetup"
in the app members already have open, encouraging real-time tasting capture during the session.

The `MeetupCard` already exists and already shows upcoming events — it just treats today the same
as next week. The "tonight" treatment is a single boolean check (`upcoming.date === todayKey()`)
away.

## User Stories
- As a member, I want to see a clear "tonight's meetup!" signal when I open the app on meetup
  day so I'm prompted to capture tastings in real-time rather than reconstructing them later.
- As Winston (the club voice), I want to announce meetup night with my own voice, setting the
  tone before the pours begin.

## Implementation

### Phase 1: Detect today's meetup in the FeedList data path

1. Open `apps/web/src/app/(app)/(shell)/page.tsx`.

2. In `FeedList`, the `upcoming` variable is already fetched with `gte("date", today)`.
   Add a derived boolean:
   ```ts
   const isTonightMeetup = upcoming?.date === today;
   ```
   (The `today` variable is already computed at line 290: `const today = new Date().toISOString().slice(0, 10);`)

3. Pass `isTonightMeetup` and `upcoming` to the JSX. Both are already available — no new queries.

**Checkpoint:** `isTonightMeetup` is `true` on meetup day, `false` otherwise. No new DB calls.

### Phase 2: Tonight banner component

1. Create `apps/web/src/components/feed/meetup-tonight-banner.tsx`:

   ```tsx
   import Link from "next/link";
   import { Button, Voice } from "@/components/primitives";

   type MeetupTonightBannerProps = {
     eventName: string;
   };

   export function MeetupTonightBanner({ eventName }: MeetupTonightBannerProps) {
     return (
       <div className="rounded-2xl border border-border bg-surface px-4 py-4 flex flex-col gap-3 mb-4">
         <Voice className="block text-sm">
           "Tonight's the night — {eventName} is happening. Pour something, tap the group in."
         </Voice>
         <Link href="/pairings/capture">
           <Button size="large" className="w-full">
             Log tonight's pours →
           </Button>
         </Link>
       </div>
     );
   }
   ```

2. Export from `apps/web/src/components/feed/index.ts`:
   ```ts
   export { MeetupTonightBanner } from "./meetup-tonight-banner";
   ```

**Checkpoint:** Component renders with Winston voice line and brass CTA.

### Phase 3: Wire into feed page

1. In the feed `page.tsx`, import `MeetupTonightBanner`.

2. In the `FeedList` JSX, above the `{upcoming || last ? <MeetupCard ...> : null}` block,
   add:
   ```tsx
   {isTonightMeetup && upcoming ? (
     <MeetupTonightBanner eventName={upcoming.name} />
   ) : null}
   ```

3. The existing `MeetupCard` still renders below (or can be omitted on meetup night — Paul's
   call). The simplest approach: keep it — it shows "Last met" + "Next up" as usual.

4. Run `pnpm build`.
5. Run `pnpm lint`.

**Checkpoint:** On a day where `events.date = today`, the tonight banner appears above the
MeetupCard in the For You tab.

## AI / Embedding Considerations
None. Voice line is a static template string using the event name. Zero AI cost.

## Design System Compliance
- `<Voice />` is used for a system message — correct per CLAUDE.md (voice appears at system
  messages).
- Single brass CTA (`<Button>`) — this is the only primary action in the banner.
- Etched divider not needed here — the banner is a standalone surface, not a section break.
- No flavor wheel, no scores, no public profiles.
- No `formatMemberName` needed — no member name in the banner.

## Mobile Constraints
- Banner is full-width, thumb-reachable. The CTA button is `size="large"` and `w-full`.
- Renders at top of For You tab — immediately visible without scrolling on meetup day.

## Database / RLS
No changes. The `events` query already runs in `FeedList`. No new tables or policies.

## Testing
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] Manually set an event with today's date and confirm the banner appears in For You tab
- [ ] Confirm banner does NOT appear when no event is today (upcoming.date > today)
- [ ] Confirm `MeetupCard` below still renders correctly
- [ ] Mobile viewport: banner + CTA button visible above fold

## Dependencies
None. The `events` table and `MeetupCard` infrastructure are fully in place.

## Estimated Total: 30 minutes
