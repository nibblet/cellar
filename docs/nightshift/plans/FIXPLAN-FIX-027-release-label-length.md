# Fix: [FIX-027] `release_label` URL search param has no max-length guard

## Problem
On the recommend page (`/products/[id]/recommend`), the `release_label` value comes from
URL search params and is trimmed but never length-capped. It is used directly in a Supabase
`.eq("release_label_key", release_label?.trim() ?? "")` query and passed to the form as a
default value. An excessively long string (e.g. 10,000 characters) could corrupt the page
layout or be forwarded to the tasting save action unvalidated.

Supabase parameterized queries prevent SQL injection. The risk is cosmetic (broken layout) and
minor data quality (very long labels stored in DB). For a 12-person private club this is low
severity but easy to fix at the boundary.

## Root Cause
`apps/web/src/app/(app)/(shell)/products/[id]/recommend/page.tsx`, around line 58.
The `release_label` is taken from `searchParams` with only a `.trim()` — no length validation.

## Steps

1. Open `apps/web/src/app/(app)/(shell)/products/[id]/recommend/page.tsx`
2. Find the `release_label` extraction from `searchParams` (around line 56–60). It likely reads:
   ```typescript
   const release_label = searchParams?.release_label?.trim() ?? "";
   ```
3. Add a length cap immediately after:
   ```typescript
   const release_label = (searchParams?.release_label?.trim() ?? "").slice(0, 100);
   ```
4. Run `pnpm build`
5. Run `pnpm lint`

## Files Modified
- `apps/web/src/app/(app)/(shell)/products/[id]/recommend/page.tsx` — add `.slice(0, 100)` to release_label extraction

## Verify
- [ ] Build passes
- [ ] Lint passes
- [ ] Navigate to `/products/[id]/recommend?release_label=<200-char string>` — form renders cleanly, label is truncated to 100 chars
