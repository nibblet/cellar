# NCCC — Fix Tracker

Format: FIX-XXX | Title | Status | Plan

---

## FIX-001 — Identity invariant: raw name string in product detail contributor

- **Status:** done
- **Found:** 2026-05-30
- **Fixed:** 2026-05-30
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-001-contributor-name.md`
- **File:** `apps/web/src/app/(app)/(shell)/products/[id]/page.tsx` line 143
- **Summary:** Contributor name is constructed as `` `${r.contributor.name_first} ${r.contributor.name_last_initial}` `` instead of `formatMemberName(r.contributor)`. Bypasses the identity formatter, skipping uppercase normalization and future two-Paul disambiguation.

---

## FIX-002 — Missing app-layer admin check in invite server actions

- **Status:** done
- **Found:** 2026-05-30
- **Fixed:** 2026-05-30
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-002-invite-admin-check.md`
- **File:** `apps/web/src/app/(app)/(shell)/admin/invites/actions.ts`
- **Summary:** `createInvite` and `revokeInvite` server actions check auth (`getUser`) but not admin role. They rely solely on Supabase RLS to reject non-admins. RLS does protect the DB, but the app surfaces a raw Postgres error instead of a friendly "Not authorized" message. Defense-in-depth is absent.

---

## FIX-003 — Storage object leaked on signed-URL failure during capture

- **Status:** done
- **Found:** 2026-05-30
- **Fixed:** 2026-05-30
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-003-storage-leak.md`
- **File:** `apps/web/src/app/(app)/(shell)/capture/actions.ts` lines 43–54
- **Summary:** If the photo upload succeeds (line 38–41) but `createSignedUrl` fails (line 52), the action returns an error to the user but the uploaded file remains in the `product-photos` bucket forever. For 12 users the accumulation is slow, but the orphaned object wastes storage and creates noise for any future bucket audit.

---

## FIX-004 — Shell layout runs DB query with empty-string user ID

- **Status:** done
- **Found:** 2026-05-30
- **Fixed:** 2026-05-30
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-004-layout-empty-id.md`
- **File:** `apps/web/src/app/(app)/(shell)/layout.tsx` lines 7–14
- **Summary:** When `auth.user` is null (unauthenticated request reaching a shell route), the query `.eq("id", auth.user?.id ?? "")` runs with an empty string. The DB returns no row (harmless), but it fires a real DB call that returns nothing. Should short-circuit when there is no user.

---

## FIX-005 — Cellar insight and taste rationale use gpt-5-mini for structured-JSON tasks

- **Status:** done
- **Found:** 2026-05-30
- **Fixed:** 2026-05-30
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-005-nano-for-json.md`
- **Files:** `apps/web/src/lib/cellar/insight.ts` (line 169), `apps/web/src/lib/taste/rationale.ts` (line 109)
- **Summary:** Both `generateCellarInsight` and `generateRationales` use `MODELS.prose` ("gpt-5-mini") with `response_format: { type: "json_object" }`. These are pure structured-extraction tasks (JSON in, JSON out), not prose generation. CLAUDE.md explicitly says to prefer gpt-5-nano where possible. Switching would reduce per-member cost by ~5–10x for these calls.

---

## FIX-006 — Unused `release_label_source` variable in product detail page

- **Status:** done
- **Found:** 2026-05-31
- **Fixed:** 2026-05-31
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-006-unused-release-label-source.md`
- **File:** `apps/web/src/app/(app)/(shell)/products/[id]/page.tsx` line 60
- **Summary:** `release_label_source` is destructured from `searchParams` but never read. Causes a `noUnusedVariables` Biome lint error. No functional impact. One-line fix: remove from destructure (and optionally from the `SearchParams` type).

---

## FIX-007 — `mcpGetClubFeed` `recommends_only` filter under-delivers results

- **Status:** done
- **Found:** 2026-05-31
- **Fixed:** 2026-05-31
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-007-club-feed-recommends-only.md`
- **File:** `apps/web/src/lib/mcp/tools.ts` function `mcpGetClubFeed`
- **Summary:** When `recommends_only: true`, the function fetches `limit` items from the DB and filters client-side. If recent tastings are mostly non-recommends, the returned set can be far fewer than the requested `limit`. Fix: oversample (5×, capped at 100) when this filter is active so there's headroom after filtering.

---

## FIX-008 — Maker page `house_style` uses reserved moss color

- **Status:** done
- **Found:** 2026-05-31
- **Fixed:** 2026-05-31
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-008-maker-house-style-moss-color.md`
- **File:** `apps/web/src/app/(app)/(shell)/makers/[slug]/page.tsx` line 61
- **Summary:** The AI-derived `house_style` summary line is rendered in `text-moss-500`. Moss is reserved by the design system for "club has tested this" pairing validation signals. House style is not a club-validated designation — it's an AI aggregate of the maker's product trait vectors. Using moss here falsely implies club endorsement. Fix: swap to `text-foreground-subtle`.

---

## FIX-009 — Unused import `TagCloudEntry` in club-says-prose.ts

- **Status:** done
- **Found:** 2026-06-01
- **Fixed:** 2026-06-02
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-009-unused-import-tag-cloud-entry.md`
- **File:** `apps/web/src/lib/aggregation/club-says-prose.ts` line 1
- **Summary:** `TagCloudEntry` imported from `./group-voice` but never referenced by name in the module. Used only transitively through `GroupVoice.tag_cloud`. Biome `noUnusedImports` error. Remove from the import destructure.

---

## FIX-010 — Unused local import `productNeedsCatalogEnrichment` in enrich/index.ts

- **Status:** done
- **Found:** 2026-06-01
- **Fixed:** 2026-06-02
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-010-unused-import-enrich-index.md`
- **File:** `apps/web/src/lib/enrich/index.ts` line 11
- **Summary:** `productNeedsCatalogEnrichment` is imported locally at line 11 but never used within the file — it is re-exported directly from the source module at line 21 via `export { } from`. The local import is dead. Biome `noUnusedImports` error. Remove line 11.

---

## FIX-011 — Dead function `stripBrandPrefix` in catalog-name-cleanup.ts

- **Status:** done
- **Found:** 2026-06-01
- **Fixed:** 2026-06-02
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-011-dead-function-strip-brand-prefix.md`
- **File:** `apps/web/src/lib/catalog/catalog-name-cleanup.ts` line 50
- **Summary:** Private function `stripBrandPrefix` is defined but never called anywhere. Biome `noUnusedVariables` warning. Remnant of a planned normalization step that was not implemented. Delete the function.

---

## FIX-012 — Deprecated dead constant + `let` vs `const` in expression-normalize.ts

- **Status:** done
- **Found:** 2026-06-01
- **Fixed:** 2026-06-02
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-012-dead-constant-vintages-matter.md`
- **Files:** `apps/web/src/lib/catalog/expression-normalize.ts` lines 65, 684
- **Summary:** `VINTAGES_MATTER_PATTERNS` is an empty deprecated array that is never read (Biome `noUnusedVariables`). `let canonical` at line 684 is only assigned once and should be `const` (Biome `useConst`). Both are safe deletions / single-token changes.

---

## FIX-013 — a11y/useSemanticElements in cellar-card-controls.tsx

- **Status:** done
- **Found:** 2026-06-01
- **Fixed:** 2026-06-02
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-013-cellar-card-controls-a11y.md`
- **File:** `apps/web/src/components/cellar/cellar-card-controls.tsx` line 39
- **Summary:** `<div role="group">` wrapping icon buttons triggers Biome `useSemanticElements` error (suggests `<fieldset>`). `<fieldset>` is semantically incorrect for button groups (not form inputs). Fix: add `biome-ignore` with explanation.

---

## FIX-014 — a11y/useSemanticElements in tasting-action-segment.tsx

- **Status:** done
- **Found:** 2026-06-01
- **Fixed:** 2026-06-02
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-014-tasting-segment-a11y.md`
- **File:** `apps/web/src/components/product/tasting-action-segment.tsx` line 22
- **Summary:** `<div role="group">` wrapping `<Link>` elements (navigation) triggers Biome `useSemanticElements` error (suggests `<fieldset>`). `<fieldset>` is wrong for navigation links. Fix: add `biome-ignore` with explanation.

---

## FIX-015 — Identity invariant in group-validation.ts (raw template string for display_name)

- **Status:** planned
- **Found:** 2026-06-02
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-015-group-validation-identity.md`
- **Files:** `apps/web/src/lib/pairing/group-validation.ts` lines 76 and 137
- **Summary:** `checkEventValidation` (line 76) and `checkPairingSessionValidation` (line 137) both construct `display_name` via `` `${t.user.name_first} ${t.user.name_last_initial}` `` instead of `formatMemberName(user)`. This is the same pattern fixed in FIX-001. The `display_name` field is shown in the pairing detail UI for club-validated pairings. Bypasses the identity formatter, missing uppercase normalization and the two-Paul disambiguation path.

---

## FIX-016 — Scene generator --size flag silenced by TypeScript cast

- **Status:** planned
- **Found:** 2026-06-02
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-016-scene-generator-size-cast.md`
- **File:** `apps/web/scripts/media/generate-catalog-scenes.ts` lines 72 and 129
- **Summary:** The `--size` CLI flag value is assigned as `string` and cast to `"1024x1024"` at the OpenAI API call site (`size: size as "1024x1024"`). An invalid value like `--size 512x512` passes TypeScript silently and only fails at the API. Fix: add an allowlist check for valid gpt-image-1 sizes (`1024x1024`, `1536x1024`, `1024x1536`, `auto`) and the same for `--quality`. No production risk (script-only) but prevents confusing runtime errors.

---

## FIX-017 — `subtitle` missing from shelf-scored ReachForNextPick (TypeScript build failure)

- **Status:** found
- **Found:** 2026-06-03
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-017-subtitle-missing-reach-for-next.md`
- **File:** `apps/web/src/lib/suggestions/load-product-suggestions.ts` lines 108–117
- **Summary:** Commit `3b1acfb` added `subtitle: string | null` as a required field to `AdjacentProduct` (in `suggest-adjacent.ts`). `suggestAdjacentProducts` now computes it. However, `loadReachForNext` also constructs `ReachForNextPick` objects manually for the shelf-first path, and those object literals were not updated. The missing required field will cause `pnpm build` to fail with a TypeScript type error. Fix: import `composeProductSubtitle` in `load-product-suggestions.ts` and add `subtitle: composeProductSubtitle(source.type, row.specs ?? {})` to the shelf-scored object.
