# Dev Plan: [IDEA-035] Type filter on personal tasting history

## What This Does

Adds a cigar / bourbon / all toggle to the `/you/tastings` page. Once a member has 20+ tastings
the unfiltered list mixes cigars and bourbons with no way to segment them. A simple three-state
toggle at the top of the history (All · Cigars · Bourbons) filters the card list instantly. For
12 members the dataset is small enough that client-side filtering is appropriate — no extra DB
roundtrip needed.

This is entirely within the existing Cellar/You hub pattern and requires no new routes, no DB
changes, and zero AI cost.

## User Stories

- As a member, I want to view only my cigar tastings so I can track which sticks I've tried without
  bourbon entries scrolling between them.
- As a member, I want to view only my bourbon tastings so I can review my whiskey notes in one
  focused list.
- As a member, I want to view all my tastings combined so I can see my full timeline as it is today.

## Implementation

### Phase 1: Thread product type through the tasting data

1. Open `apps/web/src/app/(app)/(shell)/you/tastings/page.tsx`.
   - Confirm the page renders `<TastingsSection tastings={tastings} />` or similar.
   - Confirm each tasting row already includes `products.type` (it's in the product join for the
     card render; if not, add `type` to the product SELECT in the tastings query).

2. Open the tastings query (likely in `apps/web/src/lib/taste/load.ts` or inline in the page).
   - Add `type` to the `products(...)` sub-select if not already present.
   - **Checkpoint:** `console.log(tastings[0].product.type)` in the page component should print
     "cigar" or "bourbon".

### Phase 2: Add client-side filter component

3. Create `apps/web/src/app/(app)/(shell)/you/tastings/type-toggle.tsx`:

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { label: "All", value: "all" },
  { label: "Cigars", value: "cigar" },
  { label: "Bourbons", value: "bourbon" },
] as const;

export function TastingTypeToggle({ active }: { active: string }) {
  const router = useRouter();
  const params = useSearchParams();

  function select(value: string) {
    const p = new URLSearchParams(params);
    if (value === "all") p.delete("type");
    else p.set("type", value);
    router.replace(`/you/tastings?${p.toString()}`);
  }

  return (
    <div role="group" aria-label="Filter by type" className="flex gap-1 mb-4"> {/* biome-ignore lint/a11y/useSemanticElements: button group, not form inputs */}
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => select(o.value)}
          className={cn(
            "px-3 py-1 rounded-full text-sm font-medium transition-colors",
            active === o.value
              ? "bg-brass-500 text-white"
              : "bg-surface-subtle text-foreground-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
```

4. In `apps/web/src/app/(app)/(shell)/you/tastings/page.tsx`:
   - Accept `searchParams` prop (async in Next 16: `{ searchParams }: { searchParams: Promise<{ type?: string }> }`).
   - Await it: `const { type } = await searchParams`.
   - Derive `activeType = type === "cigar" || type === "bourbon" ? type : "all"`.
   - Filter the tastings: `const filtered = activeType === "all" ? tastings : tastings.filter(t => t.product.type === activeType)`.
   - Render `<TastingTypeToggle active={activeType} />` above the tasting list.
   - Pass `filtered` to the tasting section component.
   - **Checkpoint:** Navigate to `/you/tastings?type=cigar` — only cigar cards appear.

### Phase 3: Polish

5. If the filtered list is empty, render a Winston `<Voice />` empty state only if the member
   has tastings of the OTHER type (so it's a genuine empty-filtered state, not a first-timer):
   `"No cigar tastings yet. Tap capture and light one up."`
   But do NOT use `<Voice />` here — this is a form/history context. Use a plain `<p>` italic
   serif: `<p className="text-center text-sm text-foreground-subtle italic font-serif">`.

6. Ensure the toggle is thumb-reachable on iPhone: the three buttons should be left-aligned or
   centered, not spread full-width (avoid hard stretches). Existing `gap-1` + `px-3 py-1` hits
   the 44px tap-target guideline for the compact pills.

7. `pnpm build` — verify no TypeScript errors.

8. `pnpm lint` — verify no Biome errors. (The `biome-ignore` comment on the role="group" div
   follows the pattern of FIX-013 and FIX-014.)

## AI / Embedding Considerations

None — purely a UI filter over already-fetched data.

## Design System Compliance

- Single brass action: the toggle uses brass-500 for the active pill, which functions as a
  navigation/filter selection, not a "primary action." Only one brass pill is active at a time.
  This is the `Chip`/filter pattern, not a brass CTA — acceptable. Alternatively, use the
  existing `Chip` primitive from `components/primitives/` if it handles active state.
- Winston: not used (history/form context — correct per design system rules).
- No etched dividers needed for this toggle.
- `formatMemberName`: not applicable.

## Mobile Constraints

- Three-pill toggle must be touch-friendly. Verify 44px minimum tap target per pill.
- Pills should not overflow on small screens — use `flex-wrap` if needed.
- `useRouter` + `useSearchParams` requires `<Suspense>` wrapper in the parent page; add if needed
  (Next.js 16 requirement for `useSearchParams` in `"use client"` components rendered on server).

## Database / RLS

No changes.

## Testing

- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] `/you/tastings` shows all cards with "All" tab active
- [ ] `/you/tastings?type=cigar` shows only cigar cards
- [ ] `/you/tastings?type=bourbon` shows only bourbon cards
- [ ] Toggling the pill updates the URL and re-renders without full page reload
- [ ] Empty filtered state shows plain italic message (no `<Voice />`)
- [ ] Mobile viewport: pills are thumb-reachable, no overflow

## Dependencies

None. Fully self-contained. The tastings query already joins products.

## Estimated Total: 30 minutes
