# Dev Plan: [IDEA-034] Monthly Club Pulse card on the For You feed

## What This Does
Adds a "This month at NCCC" summary card near the top of the For You feed tab, showing the
club's aggregate activity for the current calendar month: total tastings logged, unique products
tried, and pairings captured. The card appears only when there are 5+ tastings in the current
month — if the club is dormant, it hides silently.

For 12 active friends this gives Paul and new members an at-a-glance pulse of how lively the
club has been without requiring a dedicated analytics page. The card complements the existing
"Upcoming meetup" and "Daily Pour" cards with a momentum signal: "The club tried 14 things this
month — get in on it."

## User Stories
- As a member, I want to see how active the club has been this month so I get a sense of the
  momentum.
- As Winston (the club voice), I want the For You feed to feel alive and socially aware even
  when I'm not logged in frequently.

## Implementation

### Phase 1: Data loader
1. Create `apps/web/src/lib/feed/club-pulse.ts`:
   ```ts
   import type { SupabaseClient } from "@supabase/supabase-js";

   export type ClubPulse = {
     tastings: number;
     products: number;
     pairings: number;
     month: string; // "June 2026"
   };

   export async function loadClubPulse(
     supabase: SupabaseClient,
     monthStart: string, // "YYYY-MM-01"
   ): Promise<ClubPulse | null> {
     const [tastingsResult, pairingsResult] = await Promise.all([
       supabase
         .from("tastings")
         .select("product_id", { count: "exact" })
         .gte("created_at", monthStart)
         .is("pairing_session_id", null), // solo tastings only
       supabase
         .from("pairing_sessions")
         .select("id", { count: "exact" })
         .gte("created_at", monthStart),
     ]);

     const tastingCount = tastingsResult.count ?? 0;
     const pairingCount = pairingsResult.count ?? 0;

     if (tastingCount + pairingCount < 5) return null;

     // Unique products: use JS dedup on the tasting rows (already fetched)
     const rows = tastingsResult.data ?? [];
     const uniqueProducts = new Set((rows as { product_id: string }[]).map((r) => r.product_id)).size;

     const d = new Date(monthStart);
     const month = d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

     return { tastings: tastingCount, products: uniqueProducts, pairings: pairingCount, month };
   }
   ```
   Note: The query uses `.is("pairing_session_id", null)` to exclude tasting rows that are
   part of a pairing session, so the two counts don't double-count.

2. **Checkpoint:** TypeScript compiles. Test with a direct call.

### Phase 2: `ClubPulseCard` component
1. Create `apps/web/src/components/feed/club-pulse-card.tsx`:
   ```tsx
   import { Card } from "@/components/primitives";
   import type { ClubPulse } from "@/lib/feed/club-pulse";

   export function ClubPulseCard({ pulse }: { pulse: ClubPulse }) {
     const stats: string[] = [];
     if (pulse.tastings > 0)
       stats.push(`${pulse.tastings} tasting${pulse.tastings === 1 ? "" : "s"}`);
     if (pulse.products > 0)
       stats.push(`${pulse.products} unique product${pulse.products === 1 ? "" : "s"}`);
     if (pulse.pairings > 0)
       stats.push(`${pulse.pairings} pairing${pulse.pairings === 1 ? "" : "s"}`);

     return (
       <Card className="mb-4">
         <p className="text-xs tracking-widest uppercase text-foreground-subtle mb-1">
           This month at NCCC
         </p>
         <p className="text-sm text-foreground">{stats.join(" · ")}</p>
         <p className="text-xs text-foreground-subtle mt-1">{pulse.month}</p>
       </Card>
     );
   }
   ```
   Note: NO `<Voice />` here — this is a feed card and the design system says Winston never on
   the feed. Plain informational text only.

2. Export from `apps/web/src/components/feed/index.ts` if a barrel exists there.
3. **Checkpoint:** Component renders cleanly with sample data.

### Phase 3: Wire into FeedList
1. Open `apps/web/src/app/(app)/(shell)/page.tsx`
2. Add `loadClubPulse` call alongside the existing feed queries:
   ```ts
   import { loadClubPulse } from "@/lib/feed/club-pulse";

   // In FeedList (or the page server component where feed data is fetched):
   const monthStart = new Date().toLocaleDateString("en-CA", {
     timeZone: "America/New_York",
   }).slice(0, 7) + "-01"; // "YYYY-MM-01" in ET

   const [entries, ..., clubPulse] = await Promise.all([
     loadFeed(supabase, { userId, limit: 50 }),
     ...,
     loadClubPulse(supabase, monthStart),
   ]);
   ```
3. Pass `clubPulse` as a prop to `FeedList` (or render `ClubPulseCard` directly in the page
   component). Render it above the Daily Pour card but below the meetup card:
   ```tsx
   {clubPulse ? <ClubPulseCard pulse={clubPulse} /> : null}
   ```
4. **Checkpoint:** Navigate to the For You tab — the pulse card appears when the month has 5+
   tastings; it is absent for the first few days of a quiet month.

## AI / Embedding Considerations
None. This is pure DB aggregate counts. Zero API calls.

## Design System Compliance
- Single brass action confirmed (no brass element added here).
- **No Winston voice** — the card is a feed card with plain informational text. The "Never on
  feed" design system rule applies; the card uses structured labels, not Winston prose.
- `formatMemberName` not needed here.
- Etched dividers at section breaks — no new divider needed; the card sits inline.

## Mobile Constraints
Card is compact — two text lines. Works at 320px. One-handed scrollable.

## Database / RLS
No new migrations. Uses existing `tastings` and `pairing_sessions` tables. Both are
authenticated-member readable (existing RLS).

## Testing
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` for `lib/feed/club-pulse.ts` if unit tests are added
- [ ] For You feed shows pulse card when month has ≥ 5 tastings
- [ ] Pulse card hidden when month has < 5 tastings
- [ ] Month label is correct in Eastern Time (not UTC — "June 2026" at 11:30 PM ET on June 30)
- [ ] Card has no Winston voice component (verify no `<Voice>` import in club-pulse-card.tsx)

## Dependencies
None. Self-contained. No other feature required first.

## Estimated Total: 45 minutes
