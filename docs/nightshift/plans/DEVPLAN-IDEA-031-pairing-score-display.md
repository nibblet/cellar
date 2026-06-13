# Dev Plan: [IDEA-031] Pairing Compatibility Score on Pairing Detail Page

## What This Does
The pairing detail page at `/pairings/[cigarId]/[bourbonId]` shows Winston's prose notes and
"Why it works" bullets but never surfaces the actual compatibility score for the pair being
viewed. The alternative bourbons list at the bottom does show tier labels ("Excellent match",
"Good match", etc.) — but the headline pair itself is invisible. Adding a tier-label badge
in the page header gives members immediate context for the pairing before they read the prose:
"Is this a 92/100 or a 58/100?" The answer changes how they read the notes.

The score is already computed by the same `scorePair` engine that powers the pairing engine;
no new AI calls or DB queries are needed — both trait vectors are already fetched for the page.

## User Stories
- As a member, I want to see the pairing compatibility tier when I open a pairing page so that
  I understand how well-matched this cigar and bourbon are before reading Winston's notes.
- As Winston, I want the numerical context to frame my prose — a "Good match" sets different
  expectations than a "Exceptional match."

## Implementation

### Phase 1: Compute the score inline

1. Open `apps/web/src/app/(app)/(shell)/pairings/[cigarId]/[bourbonId]/page.tsx`

2. Add `scorePair` to the imports at the top:
   ```typescript
   import { scorePair } from "@/lib/pairing/score";
   ```

3. After the `notFound()` guards (around line 45), add:
   ```typescript
   const { score: pairingScore } = scorePair(cigar.trait_vector, bourbon.trait_vector);
   ```
   Both trait vectors are guaranteed non-null by the check at line 44.

   **Checkpoint:** `pnpm build` passes — `scorePair` types and imports are clean.

### Phase 2: Render the tier badge in the header

4. The page already imports `pairingTierLabel` from `@/lib/pairing/tier` (line 9). Use it
   to convert the score to a human-readable tier string.

5. In the `<header>` section (around line 66), add the tier badge between the "Winston
   suggests" label and the cigar name:
   ```tsx
   <header className="mb-6 flex flex-col items-center text-center">
     <Winston variant="bust" size={72} className="mb-3 rounded-full" />
     <p className="text-sm tracking-widest uppercase text-foreground-subtle">Winston suggests</p>
     
     {/* ← ADD THIS */}
     <span className="mt-1 px-2.5 py-0.5 rounded-full text-[11px] tracking-widest uppercase border border-border text-foreground-muted">
       {pairingTierLabel(pairingScore)}
     </span>
     
     <h1 className="text-3xl mt-2">{cigar.name}</h1>
     <p className="text-sm text-foreground-muted">with</p>
     <h2 className="text-2xl">{bourbon.name}</h2>
   </header>
   ```

   **Checkpoint:** Navigate to a pairing detail page — the tier label ("Good match",
   "Excellent match", etc.) appears between "Winston suggests" and the cigar name.

### Phase 3: Polish

6. Check `pairingTierLabel` output for the score range 0–100. Common values from the
   engine: ~55–70 = "Good match", ~70–85 = "Excellent match", ~85+ = "Exceptional match".
   Confirm the label reads naturally in context.

7. Optional: if the score is below 70 (e.g., a marginal "Decent match"), consider muting
   the badge visually with `text-foreground-subtle` instead of `text-foreground-muted` to
   soften the signal. Apply judgment — don't overthink it.

   **Checkpoint:** Visual check on mobile viewport — badge sits cleanly in the header,
   doesn't crowd the product names.

## AI / Embedding Considerations
None. `scorePair` is pure JS cosine + rules logic — zero API calls, zero latency cost.

## Design System Compliance
- No brass element — the badge is a neutral metadata chip, not a CTA
- Winston / `<Voice>` not added to the header (prose section already has it)
- No moss color — this is computed score, not club validation
- Etched divider not needed (header area)
- `formatMemberName` not involved

## Mobile Constraints
- Single-line badge in centered header — fits on any iPhone width
- Text size `text-[11px]` matches the "Winston suggests" label scale — consistent optical weight

## Database / RLS
None.

## Testing
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] Pairing detail page renders tier label between "Winston suggests" and cigar name
- [ ] Tier label reflects computed score (spot-check against `rankPairingCandidates` values in dev)
- [ ] `pairingTierLabel` import already present on this page — confirm no duplicate import
- [ ] Verified on at least one known "Excellent match" and one "Good match" pair

## Dependencies
- `scorePair` from `@/lib/pairing/score` — already used elsewhere in the pairing engine; no
  new dependency.
- `pairingTierLabel` from `@/lib/pairing/tier` — already imported in this page (line 9 of
  the current page.tsx).

## Estimated Total: 20 minutes
