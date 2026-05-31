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
