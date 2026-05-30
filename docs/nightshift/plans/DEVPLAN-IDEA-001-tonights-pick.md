# Dev Plan: [IDEA-001] Cellar-Aware "Tonight's Pick" on Cellar Page

## What This Does
Add a Winston one-liner at the top of the cellar page that nominates the best pairing from the member's Have shelf for tonight — e.g., *"For a Thursday in May: that Oliva Serie V with the Weller 12."*

The pick is deterministic, derived from the same `selectPickPour` / `loadPickPourCandidates` logic that already powers the `/pick-pour` Server Action. No new AI call is needed: the suggestion uses a short inline Winston template string, keeping latency near-zero and cost at $0.

This closes a UX gap: members land on the cellar page to see their shelf, but there is no moment of delight — no voice, no suggestion. The Tonight's Pick line gives Winston a foothold here without violating the rule that Winston doesn't appear on the feed or product-detail.

## User Stories
- As a member, I want to see a quick pairing suggestion when I open my cellar so that I know what to reach for tonight without navigating away.
- As Winston (the club voice), I want to appear on the cellar page so that the shelf feels alive rather than a static inventory list.

## Implementation

### Phase 1: Data Loading
1. In `apps/web/src/app/(app)/(shell)/you/cellar/page.tsx`, add a new `TonightsPickSection` async server component (mirrors the pattern of `TryNextSection` and `CellarInsightSection` already in this file).
2. Inside `TonightsPickSection`, call:
   ```ts
   const candidates = await loadPickPourCandidates(supabase, memberId);
   const pick = selectPickPour({ memberId, date: todayKey() }, candidates);
   ```
   Both functions are already imported in `pick-pour/actions.ts`; add them to imports here.
3. If `pick` is null (no valid Have-shelf pair), return null — section is invisible.
4. **Checkpoint:** `pick` correctly returns a `{ cigar_id, bourbon_id }` pair for a member with both types on their shelf.

### Phase 2: Product Name Lookup
1. When `pick` is non-null, fetch product names for the cigar and bourbon IDs:
   ```ts
   const { data: products } = await supabase
     .from("products")
     .select("id, name, brand, type")
     .in("id", [pick.cigar_id, pick.bourbon_id]);
   ```
2. Map to `cigar` and `bourbon` by type. Both should always resolve — these IDs come from confirmed catalog products on the member's shelf.
3. Build the display name as: `brand ? "${brand} ${name}" : name`.
4. **Checkpoint:** Names resolve for a real member's shelf pair.

### Phase 3: Winston Voice Line + UI
1. Generate a deterministic one-liner. No LLM. Use a small template based on the day of the week:
   ```ts
   const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
   const day = days[new Date().getUTCDay()];
   const line = `"For a ${day} on the porch: ${cigarDisplay} with the ${bourbonDisplay}."`;
   ```
   This is intentionally simple. The Winston character comes from context, not from over-engineering the template.
2. Render above the `CellarInsightSection`:
   ```tsx
   <Suspense fallback={null}>
     <TonightsPickSection memberId={auth.user.id} />
   </Suspense>
   ```
3. Inside `TonightsPickSection`, render:
   ```tsx
   <>
     <Divider label="Tonight's pick" />
     <Voice className="block mb-2">{line}</Voice>
     <Link href={`/pairings/${pick.cigar_id}/${pick.bourbon_id}`}>
       <Button variant="secondary" size="small">See the pairing →</Button>
     </Link>
   </>
   ```
   `<Voice />` renders Winston's italic Playfair styling. `Button variant="secondary"` (not Brass) — this is a navigation affordance, not a primary action.
4. **Checkpoint:** Section renders on the cellar page with a voice line and a link to the pairing detail.

### Phase 4: Edge-Case Handling
1. If `pick` is null but member has items on the shelf (one type only, or no trait vectors), return null silently — no fallback text, no empty state.
2. If product lookup returns fewer than 2 results (data integrity issue), return null.
3. Ensure the Suspense fallback is `null` so there's no skeleton flash for this section.
4. **Checkpoint:** Members with only cigars or only bourbons on their shelf see no Tonight's Pick section; no error.

## AI / Embedding Considerations
- No AI call. Template string only.
- Cost: $0. Latency: sub-millisecond.
- Fallback: return null on any error (already handled by Suspense).

## Design System Compliance
- Single brass action confirmed — `Tonight's Pick` uses a `secondary` button, not the brass primary.
- Winston's `<Voice />` used here: this is the cellar (personal utility screen), not feed or product detail. Permitted.
- Etched `<Divider label="Tonight's pick" />` above the section.
- `formatMemberName` not needed here (no member name rendered).

## Mobile Constraints
- One-handed iPhone: the Voice line + button are above the fold. The link is thumb-reachable.
- No new client component needed — pure server rendering.

## Database / RLS
- No new queries beyond what `loadPickPourCandidates` and the name fetch already do.
- Both hit `member_saves` (own-only RLS) and `products` (all-members read).

## Testing
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] Member with ≥1 cigar and ≥1 bourbon on Have shelf: Tonight's Pick section appears
- [ ] Member with only cigars (or only bourbons) on shelf: section absent, no error
- [ ] Member with empty shelf: section absent
- [ ] Link from Tonight's Pick navigates to the correct `/pairings/[cigarId]/[bourbonId]` page
- [ ] Mobile viewport (375px): Voice line + button visible above fold

## Dependencies
- `loadPickPourCandidates` from `lib/pick-pour/load` (already exists, tested)
- `selectPickPour` from `lib/pick-pour/select` (already exists, tested)
- `todayKey` from `lib/daily-pour/select` (already exists)

## Estimated Total: 1–2 hours
