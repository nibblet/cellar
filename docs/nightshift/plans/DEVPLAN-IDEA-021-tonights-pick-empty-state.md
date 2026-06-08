# Dev Plan: [IDEA-021] Tonight's Pick empty-shelf Winston voice

## What This Does
When a member's Have shelf is empty (or their items have no opposite-type pair available),
`TonightsPickSection` returns `null` and the cellar page silently skips the section. The
member sees no acknowledgement of the Tonight's Pick concept at all — there's no invitation
to add bottles. Adding a small Winston `<Voice />` empty state ("The shelf's bare. Add something
to have on hand and I'll pick tonight's pour.") with a direct link to the Bourbons catalog closes
this feedback loop. Zero AI cost, five-minute change.

## User Stories
- As a member with an empty Have shelf, I want to see Winston acknowledge there's nothing to pick
  from, so I know the feature is there waiting for me to add bottles.
- As Winston (the club voice), I want to prompt members to build their shelf so I can serve
  meaningful evening recommendations.

## Implementation

### Phase 1: Single file change
1. Open `apps/web/src/app/(app)/(shell)/you/cellar/page.tsx`
2. Find `TonightsPickSection` function (starting around line 62).
3. Find the early return when `pick` is null (currently `if (!pick) return null;` around line 66).
4. Replace that bare `return null` with an empty-state block:

```tsx
if (!pick) {
  return (
    <section className="mb-5">
      <Divider label="Tonight's pick" />
      <Voice className="block mb-2">
        "The shelf's bare. Add something to have on hand and I'll pick tonight's pour."
      </Voice>
      <Link
        href="/?tab=bourbons"
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-[12px] transition-colors",
          "h-12 px-5 text-base",
          "bg-surface text-foreground-muted border border-border hover:bg-surface-2",
        )}
      >
        Browse bourbons →
      </Link>
    </section>
  );
}
```

5. The `<Link>`, `<Voice>`, `<Divider>`, and `cn` are all already imported at the top of the file —
   no new imports needed.
6. Run `pnpm build` to verify
7. Run `pnpm lint`
8. **Checkpoint:** Visit `/you/cellar` with no Have-shelf bottles — confirm the Tonight's Pick
   section shows the empty state + "Browse bourbons →" link.

## AI / Embedding Considerations
None. Zero AI cost. The voice line is a hardcoded template, not generated.

## Design System Compliance
- No brass CTA in this section — the link uses the secondary button style (`bg-surface`), not the
  brass accent. Brass is reserved for the single primary action per screen.
- Winston voice via `<Voice />` — correct for empty states per conventions.
- `<Divider label="Tonight's pick" />` already used in the happy path; consistent here.
- No moss, no ember misuse.

## Mobile Constraints
One-handed use: the "Browse bourbons →" link is a full-height `h-12` block matching the existing
"See the pairing →" button in the happy path. Thumb-reachable.

## Database / RLS
None.

## Testing
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] Empty Have shelf shows Tonight's Pick section with Winston voice + browse link
- [ ] Have shelf with 1+ bottles still shows the normal pick (regression check)
- [ ] "Browse bourbons →" href navigates to `/?tab=bourbons` correctly

## Dependencies
None. Fully self-contained.

## Estimated Total: 5 minutes
