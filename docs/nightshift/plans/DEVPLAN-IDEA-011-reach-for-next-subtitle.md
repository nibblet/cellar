# Dev Plan: [IDEA-011] Display subtitle in "Reach for next" cards (WinstonSuggests)

## What This Does

The "Similar in tier" horizontal scroll in `WinstonSuggests` already renders `p.subtitle`
(the availability/tier facts line, e.g. "Allocated · Tier 4 · 95 proof"). The "Reach for
next" scroll section — same component, same card layout — does not. After FIX-017 adds
`subtitle` to the shelf-scored `ReachForNextPick` construction, every card in both sections
will have a `subtitle` value; this plan wires it into the "Reach for next" card JSX for
visual consistency.

This is a one-line JSX addition once FIX-017 is applied. Grouping it into its own plan
because the rendering change is intentionally separate from the type fix.

## User Stories

- As a member viewing a product, I want the "Reach for next" cards to show the same
  "Allocated · Tier 3" facts strip as the "Similar in tier" cards so I can compare
  hunt difficulty at a glance.

## Implementation

### Step 1: Confirm FIX-017 is applied

Verify `apps/web/src/lib/suggestions/load-product-suggestions.ts` includes `subtitle`
in the shelf-scored `ReachForNextPick` object. If not, apply FIX-017 first.

### Step 2: Add subtitle rendering to "Reach for next" cards

Open `apps/web/src/components/product/winston-suggests.tsx`.

Find the "Reach for next" map block (around line 138). The current card JSX is:

```tsx
<Card className="h-full hover:bg-surface-2 transition-colors">
  {p.onShelf ? (
    <p className="text-[10px] uppercase tracking-widest text-foreground-subtle mb-1">
      Try tonight
    </p>
  ) : null}
  <p className="text-sm text-foreground line-clamp-3 leading-snug">{p.name}</p>
  {p.brand ? (
    <p className="text-xs text-foreground-muted truncate mt-1">{p.brand}</p>
  ) : null}
</Card>
```

Add the subtitle line after the brand, matching the `similarInTier` card pattern exactly:

```tsx
<Card className="h-full hover:bg-surface-2 transition-colors">
  {p.onShelf ? (
    <p className="text-[10px] uppercase tracking-widest text-foreground-subtle mb-1">
      Try tonight
    </p>
  ) : null}
  <p className="text-sm text-foreground line-clamp-3 leading-snug">{p.name}</p>
  {p.brand ? (
    <p className="text-xs text-foreground-muted truncate mt-1">{p.brand}</p>
  ) : null}
  {p.subtitle ? (
    <p className="text-[10px] text-foreground-muted truncate mt-1">
      {p.subtitle}
    </p>
  ) : null}
</Card>
```

### Step 3: Consider YouMightAlsoLike dead-code cleanup

`apps/web/src/components/product/you-might-also-like.tsx` is exported from the product
barrel (`components/product/index.ts`) but not imported anywhere. It was superseded by
`WinstonSuggests`. Consider deleting:

- `apps/web/src/components/product/you-might-also-like.tsx`
- Remove its export from `apps/web/src/components/product/index.ts`

Not strictly part of this plan — but the files are tiny and deletion prevents confusion.
Confirm with Paul before deleting if uncertain.

### Step 4: Verify

```
pnpm build
pnpm lint
```

Open a product detail page with shelf items. "Reach for next" cards should show the
same subtitle strip as "Similar in tier" cards.

## Files Modified

- `apps/web/src/components/product/winston-suggests.tsx` — add subtitle to "Reach for
  next" card JSX.
- (Optional) `apps/web/src/components/product/you-might-also-like.tsx` — delete dead component.
- (Optional) `apps/web/src/components/product/index.ts` — remove dead export.

## Design System Compliance

- No new primary actions.
- Winston voice not involved.
- Subtitle text uses `text-foreground-muted` — matching "Similar in tier" style (not moss).
- Card layout unchanged.

## Mobile Constraints

Cards are 168px wide with `line-clamp-3` for name; subtitle is `truncate` so no overflow.
No change to card height budget needed — subtitle is a single truncated line.

## Dependencies

- **Requires FIX-017 first.** Without it, shelf-scored items have `subtitle: undefined`
  (TypeScript error), and the subtitle line would always be falsy anyway.

## Estimated Total: 10 minutes (after FIX-017 is applied)
