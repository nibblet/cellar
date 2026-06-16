# Fix: [FIX-041] `<Voice />` on recommend page — design system violation

## Problem
`<Voice />` (Winston's italic Playfair prose) appears twice on the recommend page
(`/products/[id]/recommend`): once in the post-capture status card, once as an inline
prompt ("Care to revise?" / "What stood out?" / "How is the pour treating you?"). The design
system is explicit: Winston never appears on capture pages or forms. The recommend flow is a
tasting capture form — same class as FIX-028 (capture-form.tsx, planned) and FIX-033 (pairing
capture/taste pages, planned).

**Impact on members:** Visual inconsistency; Winston's voice loses meaning when it appears on
routine form prompts rather than reserved for empty states and system messages.

## Root Cause
`apps/web/src/app/(app)/(shell)/products/[id]/recommend/page.tsx` lines 83–97 use `<Voice />`
for:
1. **Lines 83–88** (conditional): Post-capture status card with "Good. I'm still filling in the
   details…" or "Good. The club has the name…"
2. **Lines 91–97** (unconditional): Inline prompt above the form — "Care to revise?" / "What
   stood out?" / "How is the pour treating you?"

Both are presentational hints/instructions inside a form flow, not empty states or system messages.

## Steps
1. Open `apps/web/src/app/(app)/(shell)/products/[id]/recommend/page.tsx`
2. Replace the conditional status card Voice (lines 83–88):
   ```tsx
   // BEFORE
   {confirmed || enriching ? (
     <Card className="mb-6 border border-accent/40 bg-surface">
       <Voice className="text-base">
         {enriching
           ? "Good. I'm still filling in the details — save your take below, and check back at the product page when you like."
           : "Good. The club has the name — tell us what you thought."}
       </Voice>
     </Card>
   ) : null}

   // AFTER
   {confirmed || enriching ? (
     <Card className="mb-6 border border-accent/40 bg-surface">
       <p className="text-base italic font-serif text-foreground">
         {enriching
           ? "Good. I'm still filling in the details — save your take below, and check back at the product page when you like."
           : "Good. The club has the name — tell us what you thought."}
       </p>
     </Card>
   ) : null}
   ```
3. Replace the unconditional prompt Voice (lines 91–97):
   ```tsx
   // BEFORE
   <Voice className="mb-6">
     {existing
       ? ""Care to revise?""
       : product.type === "cigar"
         ? ""What stood out?""
         : ""How is the pour treating you?""}
   </Voice>

   // AFTER
   <p className="mb-6 italic font-serif text-foreground">
     {existing
       ? "“Care to revise?”"
       : product.type === "cigar"
         ? "“What stood out?”"
         : "“How is the pour treating you?”"}
   </p>
   ```
4. Remove `Voice` from the import on line 4:
   ```tsx
   // BEFORE
   import { Card, Divider, Voice } from "@/components/primitives";
   // AFTER
   import { Card, Divider } from "@/components/primitives";
   ```
5. Run `pnpm lint`
6. Run `pnpm build`
7. Test: navigate to any product detail → tap recommend → confirm no Winston prose appears
   on the form; confirm "Care to revise?" / "What stood out?" still renders in the same
   visual style (italic serif, same positioning)

## Files Modified
- `apps/web/src/app/(app)/(shell)/products/[id]/recommend/page.tsx` — replace 2 `<Voice>` with plain `<p className="... italic font-serif">`; remove Voice import

## Verify
- [ ] Build passes
- [ ] Lint passes
- [ ] No `<Voice />` import or usage in recommend/page.tsx
- [ ] Status card and prompt text still render italic serif on the recommend page
- [ ] FIX-028 and FIX-033 plans also applied in same session for clean sweep of Voice-on-form violations
