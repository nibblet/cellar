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

- **Status:** done
- **Found:** 2026-06-02
- **Fixed:** 2026-06-03 (commit `b1ac846`)
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-015-group-validation-identity.md`
- **Files:** `apps/web/src/lib/pairing/group-validation.ts` lines 76 and 137
- **Summary:** `checkEventValidation` (line 76) and `checkPairingSessionValidation` (line 137) both construct `display_name` via `` `${t.user.name_first} ${t.user.name_last_initial}` `` instead of `formatMemberName(user)`. This is the same pattern fixed in FIX-001. The `display_name` field is shown in the pairing detail UI for club-validated pairings. Bypasses the identity formatter, missing uppercase normalization and the two-Paul disambiguation path.

---

## FIX-016 — Scene generator --size flag silenced by TypeScript cast

- **Status:** done
- **Found:** 2026-06-02
- **Fixed:** 2026-06-03 (commit `b1ac846`)
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-016-scene-generator-size-cast.md`
- **File:** `apps/web/scripts/media/generate-catalog-scenes.ts` lines 72 and 129
- **Summary:** The `--size` CLI flag value is assigned as `string` and cast to `"1024x1024"` at the OpenAI API call site (`size: size as "1024x1024"`). An invalid value like `--size 512x512` passes TypeScript silently and only fails at the API. Fix: add an allowlist check for valid gpt-image-1 sizes (`1024x1024`, `1536x1024`, `1024x1536`, `auto`) and the same for `--quality`. No production risk (script-only) but prevents confusing runtime errors.

---

## FIX-017 — `subtitle` missing from shelf-scored ReachForNextPick (TypeScript build failure)

- **Status:** done
- **Found:** 2026-06-03
- **Fixed:** 2026-06-03 (commit `b1ac846`)
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-017-subtitle-missing-reach-for-next.md`
- **File:** `apps/web/src/lib/suggestions/load-product-suggestions.ts` lines 108–117
- **Summary:** Commit `3b1acfb` added `subtitle: string | null` as a required field to `AdjacentProduct` (in `suggest-adjacent.ts`). `suggestAdjacentProducts` now computes it. However, `loadReachForNext` also constructs `ReachForNextPick` objects manually for the shelf-first path, and those object literals were not updated. The missing required field will cause `pnpm build` to fail with a TypeScript type error. Fix: import `composeProductSubtitle` in `load-product-suggestions.ts` and add `subtitle: composeProductSubtitle(source.type, row.specs ?? {})` to the shelf-scored object.

---

## FIX-018 — Missing admin auth in roadmap suggestion management actions

- **Status:** planned
- **Found:** 2026-06-04
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-018-roadmap-admin-auth.md`
- **Files:** `apps/web/src/app/(app)/(shell)/roadmap/actions.ts` lines 54–87
- **Summary:** `updateSuggestionStatus` and `deleteSuggestion` in `roadmap/actions.ts` lack any app-layer auth or admin-role check. Any authenticated member can call these server actions; the DB will reject non-admins via RLS, but the caller receives a raw Postgres error instead of a friendly "Not authorized" message. Defense-in-depth pattern missing — same class as FIX-002 (invites, now resolved). Fix: add a `requireAdminSupabase()` helper (same pattern as `admin/catalog/actions.ts`) and call it at the top of both functions.

---

## FIX-019 — Moss color used for success/feedback states — design system violation

- **Status:** planned
- **Found:** 2026-06-04
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-019-moss-color-success-states.md`
- **Files:**
  - `apps/web/src/app/(app)/(shell)/products/[id]/page.tsx` line 196 (member-visible: "Club staple" label)
  - `apps/web/src/components/product/photo-manager.tsx` line 151 (photo upload ok feedback)
  - `apps/web/src/app/(app)/(shell)/products/[id]/edit/edit-form.tsx` line 225 (enrichment done)
  - `apps/web/src/app/(app)/(shell)/makers/[slug]/maker-admin-actions.tsx` line 72 (blurb regenerated)
  - `apps/web/src/app/(app)/(shell)/admin/meetup/meetup-form.tsx` line 72 (meetup saved)
- **Summary:** Design system reserves `text-moss-*` exclusively for "club has tested this pairing" validation signals. Five places use it for generic success/ok states. The most impactful is the "Club staple" label on product detail — it uses the same visual language as club-validated pairing indicators, misleadingly implying club endorsement. Fix: swap all five to `text-foreground-muted` or `text-foreground`.

---

## FIX-020 — Dead `YouMightAlsoLike` component — exported but never imported

- **Status:** planned
- **Found:** 2026-06-04
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-020-dead-youmightalsolike.md`
- **Files:**
  - `apps/web/src/components/product/you-might-also-like.tsx` (file to delete)
  - `apps/web/src/components/product/index.ts` line 15 (re-export to remove)
- **Summary:** `YouMightAlsoLike` is exported from the product component barrel but never imported in any page or component. It was superseded by `WinstonSuggests` (shipped 2026-06-01). Safe to delete — zero callers confirmed by grep. Biome `noUnusedExports` would flag this if the barrel itself were an entry point.

---

## FIX-021 — Storage leak on DB insert failure in product-photo admin route

- **Status:** planned
- **Found:** 2026-06-05
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-021-product-photo-storage-leak.md`
- **File:** `apps/web/src/app/api/product-photo/route.ts` lines 109–124
- **Summary:** In the `POST` handler's `target=member` path, the storage upload succeeds (line 109–114) but the subsequent `product_images` DB insert can fail. When it does, the handler returns a 500 without cleaning up the uploaded storage object. Same class as FIX-003 (capture action, now resolved). Fix: add `void admin.storage.from(PHOTOS_BUCKET).remove([storagePath])` before the 500 return when `insertErr` is set.

---

## FIX-022 — Moss color in settings form success states (additional violations)

- **Status:** planned
- **Found:** 2026-06-05
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-022-moss-settings-forms.md`
- **Files:**
  - `apps/web/src/app/(app)/(shell)/you/settings/avatar-uploader.tsx` line 50
  - `apps/web/src/app/(app)/(shell)/you/settings/display-name-form.tsx` line 48
  - `apps/web/src/app/(app)/(shell)/settings/preferences-form.tsx` line 116
  - `apps/web/src/app/(app)/(shell)/roadmap/suggestion-form.tsx` line 69
- **Summary:** Four more member-facing forms use `text-moss-600` as generic success feedback (avatar saved, name saved, preferences saved, suggestion sent). Same design system violation as FIX-019 (which covers the 5 most impactful sites). Fix: swap all four to `text-foreground-muted`. Note: `admin/invites/page.tsx` (redeemed invite) and `admin/suggestions/suggestion-row.tsx` (done status) also use moss — tracked as acceptable admin-internal use pending Paul's decision.

---

## FIX-023 — Storage leak in pairing capture on sign/identify failure

- **Status:** planned
- **Found:** 2026-06-06
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-023-pairing-capture-storage-leak.md`
- **File:** `apps/web/src/app/(app)/(shell)/pairings/capture/actions.ts` lines ~47–72
- **Summary:** `identifyPairingPhoto` uploads a photo to `product-photos`, then calls `createSignedUrl` and `identifyPairFromImage`. If either step fails, the uploaded file is abandoned in storage without cleanup. Same class as FIX-003 (single capture, resolved) and FIX-021 (product-photo admin route, planned). Fix: add `void supabase.storage.from(BUCKET).remove([storagePath])` before each error return that occurs after the upload succeeds — identical pattern to the resolved FIX-003.

---

## FIX-024 — UTC weekday in Tonight's Pick voice line

- **Status:** planned
- **Found:** 2026-06-07
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-024-utc-day-name.md`
- **File:** `apps/web/src/app/(app)/(shell)/you/cellar/page.tsx` line 85
- **Summary:** `TonightsPickSection` derives the weekday name for Winston's voice line using `new Date().getUTCDay()`. After 8pm EDT (UTC-4), the UTC date has already rolled to the next calendar day. Members in Louisville, KY see "For a Wednesday on the porch" during Tuesday evening meetups. Fix: replace `days[new Date().getUTCDay()]` with `new Date().toLocaleDateString("en-US", { weekday: "long", timeZone: "America/New_York" })`. The pick rotation itself (`todayKey()`) correctly uses UTC and is not changed by this fix.

---

## FIX-025 — UTC date in FeedList `today` causes meetup events to flip prematurely

- **Status:** planned
- **Found:** 2026-06-08
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-025-utc-date-feed-today.md`
- **File:** `apps/web/src/app/(app)/(shell)/page.tsx` line 290
- **Summary:** `FeedList` derives `today` via `new Date().toISOString().slice(0, 10)` — UTC-based. After 8pm EDT (UTC-4), the UTC date rolls to the next calendar day. A meetup event with `date` = today flips from the "upcoming" events query to the "last" events query at 8pm EDT — while the club is still on the porch. The MeetupCard shows "Last meetup" instead of "Upcoming meetup." This also affects the planned IDEA-014 meetup-tonight banner (`upcoming.date === today` never fires after 8pm). Same class as FIX-024 (cellar UTC weekday). Fix: replace the UTC slice with `new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" })` which natively produces YYYY-MM-DD in ET.

---

## FIX-026 — MCP single-token design exposes any member's private cellar to all bearer-token holders

- **Status:** planned
- **Found:** 2026-06-09
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-026-mcp-cross-member-access.md`
- **Files:** `apps/web/src/lib/mcp/tools.ts` (~lines 481, 534)
- **Summary:** `get_my_cellar` and `suggest_try_next` in the MCP server accept a `member_email` parameter and return that member's private shelf data and palate-based picks. The MCP server uses a single shared bearer token (`NCCC_MCP_TOKEN`). Any holder of the token can query any club member's cellar by passing their email. For 12 friends this may be intentional, but the behavior is undocumented and the existing Cloudflare OAuth proxy provides a clean path to per-user token scoping. Near-term fix: add a comment documenting the single-token design. Medium-term fix: extend the OAuth proxy to inject a verified `X-Nccc-Member-Email` header and validate it against `member_email` in the tool handlers.

---

## FIX-027 — `release_label` URL search param has no max-length guard in recommend page

- **Status:** planned
- **Found:** 2026-06-09
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-027-release-label-length.md`
- **File:** `apps/web/src/app/(app)/(shell)/products/[id]/recommend/page.tsx` (~line 58)
- **Summary:** The `release_label` value from URL search params is trimmed but never length-capped before being used in a Supabase `.eq()` query and passed to the form as a default value. An excessively long string could corrupt the page layout. Supabase parameterized queries prevent SQL injection; this is a low-severity data-boundary validation gap. Fix: add `.slice(0, 100)` immediately after `.trim()`.

---

## FIX-028 — `<Voice />` used on capture form — design system violation

- **Status:** planned
- **Found:** 2026-06-09
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-028-voice-on-capture.md`
- **Files:**
  - `apps/web/src/app/(app)/(shell)/capture/capture-form.tsx` lines 68–70 and 96
  - `apps/web/src/components/pairing/pairing-capture-flow.tsx` ~line 223
- **Summary:** The `<Voice />` component (Winston's italic Playfair prose) appears on the capture form with instructional hints: "Hold the band steady. I'll do the rest." (line 96), "One photo of the pair — I'll name the cigar and the pour." (line 68), and a loading-state narration in the pairing capture flow. The design system is explicit: Winston never appears on the capture page. His allowed contexts are empty states, recommendation intros, onboarding, and system messages. Fix: replace each `<Voice>` with a plain `<p className="text-center text-sm text-foreground-subtle italic font-serif">` — same visual feel, correct semantic.

---

## FIX-029 — `member_saves` documented as "own-only" but SELECT is club-wide; `loved` flag is cross-member visible

- **Status:** planned
- **Found:** 2026-06-10
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-029-member-saves-loved-visibility.md`
- **Files:**
  - `docs/nightshift/STATUS.md` (documentation correction)
  - `CLAUDE.md` (if "own-only" description present)
  - `supabase/migrations/20260522000001_member_saves.sql` (RLS source of truth — read-only reference)
- **Summary:** STATUS.md and NCCC conventions describe `member_saves` as "own-only (no cross-member visibility)." In reality, the RLS SELECT policy is `member_saves_select_all` — any authenticated club member can read any other member's saves, including the `loved` flag (described elsewhere as a "private signal for Try Next"). The member profile Cellar tab depends on this cross-member read silently. For 12 friends this behavior is likely intentional, but the documentation is wrong. Primary fix: correct STATUS.md. Secondary consideration: if Paul wants `loved` truly private, add a narrowed SELECT policy excluding `loved=true` from cross-member reads.

---

## FIX-030 — Duplicate cellar + taste DB calls in `loadFindNextSuggestions`

- **Status:** planned
- **Found:** 2026-06-10
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-030-find-next-duplicate-queries.md`
- **File:** `apps/web/src/lib/find-next/load.ts` — `loadProductSuggestions` (lines 116–180)
- **Summary:** `loadFindNextSuggestions` calls `loadProductSuggestions` for both "bourbon" and "cigar" via `Promise.all`. Each call independently executes `loadCellarSnapshot(supabase, memberId)` and `ensureTasteRecommendations(supabase, memberId)` — identical DB queries for the same member. Both fire simultaneously (parallel), doubling the connection overhead for these two reads. Fix: hoist both shared loads into `loadFindNextSuggestions` and pass the results as parameters to a refactored `loadProductSuggestions`. Saves ~2 DB roundtrips (~40–80ms) per find-next feed render.

---

## FIX-031 — PWA manifest references four icon files that don't exist

- **Status:** planned
- **Found:** 2026-06-11
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-031-pwa-manifest-icons.md`
- **File:** `apps/web/public/manifest.webmanifest` lines 12–35
- **Summary:** The manifest's `icons` array references `/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/icon-maskable-512.png`, and `/icons/apple-touch-icon.png`. Only `nccc-logo.png` exists in `public/icons/`. Every page load generates four 404 errors; Chrome may refuse or downgrade PWA install eligibility. The `public/icons/README.md` documents this as a "defer until launch prep" placeholder. Short-term fix: replace all four entries with the existing `nccc-logo.png` (two entries: `any` + `any maskable` at 512×512). The README generation instructions are preserved as the launch-prep path.

---

## FIX-032 — Missing max-length guard on `release_label` in session tasting action

- **Status:** planned
- **Found:** 2026-06-11
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-032-session-release-label-length.md`
- **File:** `apps/web/src/app/(app)/(shell)/products/[id]/session/actions.ts` lines 86, 88
- **Summary:** `submitSession` reads `release_label` from FormData with `as string | null` cast and `.trim()`, but no `.slice(0, 100)` max-length cap. Same class as FIX-027 (recommend page URL param). An excessively long string passes through to `saveTasting` and the `tastings` DB upsert. Fix: `String(formData.get("release_label") ?? "").trim().slice(0, 100) || null`. Also fixes the `eventId` line to use `String()` instead of an unsafe cast, matching the rest of the file's pattern.

---

## FIX-033 — `<Voice />` on pairing capture and pairing taste pages — design system violation

- **Status:** planned
- **Found:** 2026-06-12
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-033-voice-pairing-pages.md`
- **Files:**
  - `apps/web/src/app/(app)/(shell)/pairings/capture/page.tsx` lines 40–42
  - `apps/web/src/app/(app)/(shell)/pairings/[cigarId]/[bourbonId]/taste/page.tsx` line 64
- **Summary:** Two additional `<Voice />` usages in capture/form contexts not covered by FIX-028. Both render instructional text ("One photo of the pair — I'll name the cigar and the pour." and "One photo of the pair — then tell us how it sat.") using Winston's italic Playfair prose, violating the rule that Winston never appears on capture pages or forms. Fix: replace each `<Voice>` with a plain `<p className="... italic font-serif">` — same visual feel, correct semantics. Remove now-unused Voice imports.

---

## FIX-034 — Storage leak in pairing taste action on DB insert failure

- **Status:** planned
- **Found:** 2026-06-12
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-034-taste-action-storage-leak.md`
- **File:** `apps/web/src/app/(app)/(shell)/pairings/[cigarId]/[bourbonId]/taste/actions.ts` (~line 147)
- **Summary:** `submitPairingTaste` uploads a photo to the `product-photos` bucket, then inserts rows into `product_images` for both products in the pair. If the insert fails (two insert errors or row count mismatch), the action returns an error without cleaning up the already-uploaded storage object. Same class as FIX-003 (capture — resolved), FIX-021 (product-photo admin route — planned), FIX-023 (pairing capture action — planned). Fix: add `void supabase.storage.from(BUCKET).remove([storagePath])` before each post-upload early-return, matching the resolved FIX-003 pattern.

---

## FIX-035 — `GroupVoice.member_count` uses tasting row count, not distinct member count

- **Status:** found
- **Found:** 2026-06-13
- **Plan:** (not yet written)
- **File:** `apps/web/src/lib/aggregation/group-voice.ts` line 84
- **Summary:** `loadGroupVoice` returns `member_count: tastings.length` (tasting row count) and `recommend_count: tastings.reduce(...)` (recommended-tasting count). The upsert key on `tastings` is `(user_id, product_id, release_label)`, so one member can have multiple rows per product if they've logged different releases. The `RecommendBar` component uses `memberCount` to render one icon per "member" and shows "{recommendCount} of {memberCount}" — misrepresenting the bar as per-person when it's actually per-tasting-row. Fix: `member_count: new Set(tastings.map(t => t.user_id)).size` and `recommend_count: new Set(tastings.filter(t => t.recommend).map(t => t.user_id)).size`. Low-severity for 12-person club (multi-release per product is rare) but semantically incorrect.

---

## FIX-036 — `welcome/page.tsx` fires DB query with empty user ID when unauthenticated

- **Status:** found
- **Found:** 2026-06-13
- **Plan:** (not yet written)
- **File:** `apps/web/src/app/(app)/welcome/page.tsx` line 13
- **Summary:** `WelcomePage` queries `users` with `.eq("id", auth.user?.id ?? "")` before confirming auth. If `auth.user` is null (unauthenticated), the query runs with an empty string ID, returns null, and the page proceeds to show the welcome flow (graceful fallback). However it fires a wasted DB round-trip. Same class as FIX-004 (shell layout, now resolved). Fix: add `if (!auth.user) { /* show welcome flow with no profile */ }` or short-circuit to the welcome flow before querying. Note: the onboarding page is intentionally accessible without auth (members are mid-invite-flow), so the fix should not hard-redirect — it should skip the DB query, not block the page.

---

## FIX-037 — `taste/load.ts` missing error check on `UPDATE users SET taste_recommendations`

- **Status:** found
- **Found:** 2026-06-13
- **Plan:** (not yet written)
- **File:** `apps/web/src/lib/taste/load.ts` lines 191–194
- **Summary:** After rebuilding taste recommendations, `rebuild()` calls `await supabase.from("users").update({ taste_recommendations: recommendations }).eq("id", memberId)` with no error destructuring or check. If this write fails silently, the function returns the freshly-computed recommendations (correct for this call) but the cache is not updated — so the next page load recomputes everything from scratch and calls the LLM rationale generator again. Low-severity (DB writes rarely fail) but adds unnecessary LLM cost on repeated failures. Fix: destructure the error and log a warning with `console.warn` if `updateErr` is truthy, matching the pattern in `specs-enrich.ts`.

---

## FIX-038 — `hasVisionOnlySpecs` cigar logic bug — cigar catalog enrichment never triggered

- **Status:** planned
- **Found:** 2026-06-13
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-038-cigar-enrichment-logic.md`
- **File:** `apps/web/src/lib/enrich/needs-enrichment.ts` line 59
- **Summary:** `hasVisionOnlySpecs` for cigars contains a stray `return false` (line 59) inside the loop that fires as soon as a vision-only key (vitola, country, strength, wrapper_color, binder, filler, body) has a non-empty value. Since line 55 already `continue`s on empty values, the check at line 59 is always true — meaning the function exits with `return false` ("doesn't need enrichment") for virtually every captured cigar, because any cigar with even one populated vision-only spec (country, vitola, etc.) hits this early return. In contrast, the bourbon branch (lines 45–51) has the correct logic: skip empty values, return false only if a NON-vision-only key has a real value, then return true. The fix is one line: delete line 59. This unblocks cigar Apify enrichment (reviews → wheel_vector → trait_vector), which is critical for pairing quality for cigars.
