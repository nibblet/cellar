# Fix: [FIX-038] Cigar `hasVisionOnlySpecs` Logic Bug — Enrichment Never Triggered

## Problem
Cigar products captured via photo are almost never sent through the Apify catalog enrichment
pipeline (web scrape → reviews → wheel vector). This means most cigars in the DB lack
`wheel_vector`, `trait_vector`, and detailed `specs`, silently degrading pairing quality
and the group voice tag cloud for cigar products.

## Root Cause
`apps/web/src/lib/enrich/needs-enrichment.ts` — `hasVisionOnlySpecs` function, lines 53–60.

The function is intended to return `true` when a product's specs contain only vision-extracted
fields (vitola, country, strength, wrapper_color, binder, filler, body) — meaning it needs
catalog enrichment. For bourbons (lines 45–51) the logic is correct: skip empty values, return
`false` only if a non-vision-only key is found with a real value. For cigars (lines 53–60),
there is a stray `return false` on line 59 that fires as soon as a vision-only key has a
non-empty value:

```typescript
// BUGGY cigar loop (lines 53-60)
for (const [key, value] of Object.entries(specs)) {
  if (!VISION_ONLY_CIGAR_KEYS.has(key)) return false;  // correct
  if (value === null || value === undefined || value === "") continue;  // correct
  if (key === "wrapper_color" && typeof value === "string" && /appearance/i.test(value)) {
    continue;  // correct — skip vision artifact
  }
  if (value !== null && value !== undefined && value !== "") return false;  // ← BUG
}
```

Because line 55 already skipped null/empty values, when execution reaches line 59 the value
is guaranteed non-empty. The function therefore returns `false` ("no enrichment needed") for
every cigar that has ANY non-empty vision-only spec — which is virtually every cigar captured
by photo (vitola, country, and strength are almost always populated by vision). The function
should `continue` (let the loop proceed) for vision-only keys with real values, and return
`true` at the end — matching the bourbon logic exactly.

## Steps

1. Open `apps/web/src/lib/enrich/needs-enrichment.ts`

2. Remove line 59 entirely. The fixed cigar loop becomes:
   ```typescript
   // FIXED
   for (const [key, value] of Object.entries(specs)) {
     if (!VISION_ONLY_CIGAR_KEYS.has(key)) return false;
     if (value === null || value === undefined || value === "") continue;
     if (key === "wrapper_color" && typeof value === "string" && /appearance/i.test(value)) {
       continue;
     }
     // key is vision-only and value is real → keep checking; don't return early
   }
   return true;  // all non-empty keys are vision-only → needs enrichment
   ```

3. Run `pnpm test` — the unit test in `needs-enrichment.test.ts` (if it exists) should
   pass. If there's no test file, add one (see "New Files" below).

4. Run `pnpm lint`

5. Run `pnpm build`

6. Test: trigger a cigar product capture in dev — confirm `productNeedsCatalogEnrichment`
   returns `true` for a cigar with only vitola/country/strength/wrapper_color populated.

## Files Modified
- `apps/web/src/lib/enrich/needs-enrichment.ts` — remove 1 line (line 59)

## New Files (if test coverage is absent)
- `apps/web/src/lib/enrich/needs-enrichment.test.ts` — unit tests covering:
  - cigar with only vision-only specs → `hasVisionOnlySpecs` returns `true`
  - cigar with a non-vision-only spec (e.g. `reviews_count`) → returns `false`
  - bourbon with only vision-only specs → returns `true`
  - bourbon with catalog spec → returns `false`

## Database Changes
None.

## Verify
- [ ] Build passes
- [ ] Lint passes
- [ ] `pnpm test` passes (or new tests written and passing)
- [ ] A cigar with `specs: { vitola: "Toro", country: "Nicaragua", strength: "medium" }` and
      no non-vision-only keys causes `productNeedsCatalogEnrichment` to return `true`
- [ ] A cigar with `specs: { vitola: "Toro", reviews_count: 142 }` causes it to return `false`
- [ ] Bourbon logic unchanged (same behavior before and after)
