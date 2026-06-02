# Dev Plan: [IDEA-003-B] Maker Pages — Part B (Refinements)

## What This Does

Closes the gaps left after [IDEA-003 Part A](DEVPLAN-IDEA-003-maker-pages.md) shipped (2026-05-30). Part A delivered maker detail routes, Winston blurbs, house-style aggregation, product cross-links, and admin blurb edit/regenerate. The schema and UI already expose `country` and `website`, but nothing writes them. `house_style` can stay stale when enrichment adds `trait_vector`s after the first visit. Manual acceptance tests from Part A were never checked off.

Part B makes the Phase 9 definition of done true in practice: structured region + website in the header (not only prose inside the blurb), fresh house-style when the catalog matures, and admin control over factual metadata.

**Prerequisite:** Part A complete (`makers` migration applied, `makers/[slug]/page.tsx` live). Browse surfaces ([IDEA-005](DEVPLAN-IDEA-005-makers-browse.md)) already read `makers.country` / `house_style` — they benefit automatically once metadata is populated.

## Gaps Addressed (from Part A review)

| Gap | Part B fix |
|-----|------------|
| `country` / `website` columns never populated | Structured fields from the same Winston profile call (or admin edit) |
| `ensureMaker` returns early when `blurb` exists, skipping `house_style` refresh | Recompute `house_style` on every visit; upsert when changed or newly computable |
| Admin can only fix blurb, not region/URL | Optional country + website fields on admin card |
| Part A manual QA checklist open | Close with a short verification pass (documented below) |

**Out of scope:** Re-scraping the open web for maker facts; bulk backfill script for all ~100 brands (run on demand via first visit + optional one-off admin "refresh metadata" if needed later).

## User Stories

- As a member, I want to see where a maker operates and a link to their site in the header so I don't have to parse Winston's paragraph for basics.
- As a member, I want the house-style line to reflect the club's current catalog once more products have flavor data.
- As Paul (admin), I want to correct country or website when Winston's structured output is wrong, without editing the blurb prose.
- As Paul (admin), I want manual blurb edits to stay protected while metadata can still be updated separately.

## Implementation

### Phase 1: Structured maker profile (country + website)

**Goal:** One `gpt-5-mini` call returns blurb + nullable `country` + nullable `website` (same quality bar as Part A prose).

1. Add `apps/web/src/lib/makers/profile.ts` (or extend `blurb.ts`):
   ```ts
   export type MakerProfile = {
     blurb: string;
     country: string | null;
     website: string | null;
   };

   const MAKER_PROFILE_SCHEMA = {
     type: "object",
     properties: {
       blurb: { type: "string" },
       country: { type: ["string", "null"] },
       website: { type: ["string", "null"] },
     },
     required: ["blurb", "country", "website"],
     additionalProperties: false,
   } as const;
   ```
   - Reuse Winston system voice from `blurb.ts`; add: country = country or region only (e.g. `"Nicaragua"`, `"Kentucky, USA"`); website = official homepage URL or `null` if unknown. No markdown in `blurb`.
   - `response_format: { type: "json_schema", ... strict: true }`, `MODELS.prose`, `operation: "maker-profile"`.
   - Normalize `website`: prepend `https://` if missing; reject non-URL strings → `null`.

2. Replace `generateMakerBlurb` call sites with `generateMakerProfile` (keep `generateMakerBlurb` as thin wrapper returning `.blurb` only if needed for regenerate path clarity).

3. In `ensureMaker` upsert payload, set `country` and `website` from profile when `blurb_source === 'ai'` and fields are currently null (do not overwrite non-null values set by admin — see Phase 3).

4. **Checkpoint:** First visit to a maker with no row creates `blurb`, `country`, and `website` when the model has reasonable confidence; page header shows region + link.

### Phase 2: Refresh `house_style` without re-generating blurb

**Goal:** Visiting `/makers/[slug]` updates the one-line read when catalog vectors mature; does not burn tokens re-writing blurbs.

1. Refactor `apps/web/src/lib/makers/load.ts`:
   - Extract `loadMakerTraitVectors(supabase, brand, type)` and `computeHouseStyle(vectors, brand)` (pure + unit-testable).
   - Remove unconditional early return:
     ```ts
     // DELETE:
     if (existing?.blurb) return existing as MakerRow;
     ```
   - New flow:
     1. Load `existing` maker row (if any).
     2. Always load trait vectors and compute `houseStyle` (null if `< 2` vectors).
     3. Generate profile **only if** `!existing?.blurb && (existing?.blurb_source ?? 'ai') === 'ai'`.
     4. Merge metadata: use profile `country`/`website` only when existing values are null and `blurb_source !== 'manual'` for those fields OR introduce explicit `metadata_source` — **simpler approach:** treat `country`/`website` as admin-overwritable; AI fills only when null; admin form always wins once set.
     5. Admin upsert: always write `house_style` when computed value differs from stored (or stored is null and computed is non-null). Always preserve `blurb` + `blurb_source` when blurb already exists unless regenerating.

2. Optional guard: skip OpenAI when `existing?.blurb` is set (current behavior for prose) — **keep this**; only `house_style` + null metadata get updated on repeat visits.

3. Unit test: `ensureMaker` merge logic — given existing row with blurb, 3 new vectors → upsert updates `house_style`, does not call OpenAI (mock).

4. **Checkpoint:** Maker with blurb but no `house_style` gains a line after a second product is enriched; blurb text unchanged.

### Phase 3: Admin — country & website

**Goal:** Paul can fix structured facts without touching Winston's paragraph or triggering regenerate.

1. Extend `admin-actions.ts`:
   ```ts
   export async function updateMakerMetadata(
     _prev: MakerAdminState,
     formData: FormData,
   ): Promise<MakerAdminState>
   ```
   - Fields: `slug`, `country` (optional empty → null), `website` (optional empty → null, validate URL).
   - Admin client `update` on `makers`; set `updated_by`; do **not** change `blurb_source`.

2. Extend `maker-admin-actions.tsx`:
   - Inputs below blurb textarea: Country/region, Website.
   - Save metadata button (or single save for blurb + metadata — prefer **one Save** that calls both actions or one combined action to reduce clicks).

3. Regenerate behavior:
   - `regenerateMakerBlurb` → call `generateMakerProfile`, update `blurb` + `blurb_source: 'ai'`, and refresh `country`/`website` **only if** those columns are still null (don't clobber admin metadata). Document this in the regenerate button `title`.

4. **Checkpoint:** Edit country to "Honduras", save → header updates; regenerate disabled when `blurb_source === 'manual'`; regenerate when `ai` fills null website only.

### Phase 4: Backfill / existing rows (lightweight)

**Goal:** Makers created under Part A get metadata without manual SQL.

1. On `ensureMaker`, if row exists with `blurb` but `country` and `website` both null and `blurb_source === 'ai'`, allow one optional profile call:
   - **Preferred:** dedicated `fillMakerMetadataIfMissing` using the same schema but user message: "Extract country and official website only; blurb already written." Cheaper than full regen.
   - **Alternative:** no extra call — metadata appears only on regenerate or new makers until Paul edits. Document if choosing this shortcut.

2. **Checkpoint:** Visit `/makers/confidenciaal` (existing row) → country/website populate or remain null with acceptable fallback.

### Phase 5: Manual QA (close Part A + Part B)

Run once on production or staging after deploy:

- [ ] `/makers/<known-slug>` — header shows country + website when profile ran
- [ ] Product detail brand link → maker page
- [ ] Empty catalog house — Winston empty-state line (no products)
- [ ] Admin: save blurb → `blurb_source = manual`, regenerate disabled
- [ ] Admin: save country/website → persists, survives reload
- [ ] Admin: regenerate (`ai`) → new blurb; metadata rules per Phase 3
- [ ] Maker with 2+ enriched products — `house_style` visible, `text-foreground-subtle` (not moss)
- [ ] `/makers` browse card shows `country` when set
- [ ] Mobile 375px: header + blurb readable without excessive scroll

Update checkboxes in Part A plan or mark complete in `docs/nightshift/NIGHTLOG.md`.

## AI / Embedding Considerations

- **New makers:** one `gpt-5-mini` structured call (`maker-profile`) replaces plain-text blurb call — same model, slightly more output tokens.
- **Repeat visits:** $0 — house-style only (in-process).
- **Metadata backfill (Phase 4):** optional second minimal call per stale row; cap with "only if both null" to avoid re-hitting every page load (gate with `metadata_filled_at` column only if load becomes noisy — **not required for v1**).
- Regenerate: same as today, plus nullable metadata merge rules.

## Design System Compliance

- Country/website: `text-foreground-muted`, same as current page — no brass, no moss.
- `house_style`: keep `text-foreground-subtle` per [FIX-008](FIXPLAN-FIX-008-maker-house-style-moss-color.md).
- Admin card: secondary/ghost buttons only; no new primary brass on maker page.
- Winston blurb: unchanged (`WinstonTastingNote`).

## Mobile Constraints

- Admin metadata inputs: full-width, 44px min tap on save.
- Website link: external `rel="noopener noreferrer"`, truncate display host in UI if URL is long (already strips protocol).

## Database / RLS

- No migration required for Part B v1 (columns exist).
- Optional future: `metadata_source text check (metadata_source in ('ai','manual'))` if overwrite rules get confusing — defer unless Paul needs it.

## Testing

- [ ] `pnpm test` — new tests for `computeHouseStyle` merge + profile JSON parse
- [ ] `pnpm build` / `pnpm lint`
- [ ] Phase 5 manual QA checklist (above)

## Dependencies

- [x] Part A: `DEVPLAN-IDEA-003-maker-pages.md`
- [x] `makers` migration `20260530000001_makers.sql` applied
- [x] FIX-008 house_style color (done)
- [ ] Part B Phases 1–3 code
- [ ] Phase 4 decision (backfill call vs visit-only for legacy rows)

## Files Touched (expected)

| File | Change |
|------|--------|
| `lib/makers/profile.ts` | New structured Winston profile |
| `lib/makers/blurb.ts` | Delegate or remove in favor of profile |
| `lib/makers/load.ts` | Refresh logic, metadata merge |
| `lib/makers/load.test.ts` | House-style refresh without blurb regen |
| `makers/[slug]/admin-actions.ts` | Metadata update |
| `makers/[slug]/maker-admin-actions.tsx` | Country/website inputs |
| `planning/nccc-implementation-plan.md` | Check off Phase 9 when Part B + QA done |

## Estimated Total: 2–3 hours

- Phase 1–2: ~1.5 h (core value)
- Phase 3: ~45 min
- Phase 4–5: ~30 min (QA + optional backfill)
