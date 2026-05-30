# NCCC — Fix Tracker

Format: FIX-XXX | Title | Status | Plan

---

## FIX-001 — Identity invariant: raw name string in product detail contributor

- **Status:** planned
- **Found:** 2026-05-30
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-001-contributor-name.md`
- **File:** `apps/web/src/app/(app)/(shell)/products/[id]/page.tsx` line 143
- **Summary:** Contributor name is constructed as `` `${r.contributor.name_first} ${r.contributor.name_last_initial}` `` instead of `formatMemberName(r.contributor)`. Bypasses the identity formatter, skipping uppercase normalization and future two-Paul disambiguation.

---

## FIX-002 — Missing app-layer admin check in invite server actions

- **Status:** planned
- **Found:** 2026-05-30
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-002-invite-admin-check.md`
- **File:** `apps/web/src/app/(app)/(shell)/admin/invites/actions.ts`
- **Summary:** `createInvite` and `revokeInvite` server actions check auth (`getUser`) but not admin role. They rely solely on Supabase RLS to reject non-admins. RLS does protect the DB, but the app surfaces a raw Postgres error instead of a friendly "Not authorized" message. Defense-in-depth is absent.

---

## FIX-003 — Storage object leaked on signed-URL failure during capture

- **Status:** planned
- **Found:** 2026-05-30
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-003-storage-leak.md`
- **File:** `apps/web/src/app/(app)/(shell)/capture/actions.ts` lines 43–54
- **Summary:** If the photo upload succeeds (line 38–41) but `createSignedUrl` fails (line 52), the action returns an error to the user but the uploaded file remains in the `product-photos` bucket forever. For 12 users the accumulation is slow, but the orphaned object wastes storage and creates noise for any future bucket audit.

---

## FIX-004 — Shell layout runs DB query with empty-string user ID

- **Status:** planned
- **Found:** 2026-05-30
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-004-layout-empty-id.md`
- **File:** `apps/web/src/app/(app)/(shell)/layout.tsx` lines 7–14
- **Summary:** When `auth.user` is null (unauthenticated request reaching a shell route), the query `.eq("id", auth.user?.id ?? "")` runs with an empty string. The DB returns no row (harmless), but it fires a real DB call that returns nothing. Should short-circuit when there is no user.

---

## FIX-005 — Cellar insight and taste rationale use gpt-5-mini for structured-JSON tasks

- **Status:** planned
- **Found:** 2026-05-30
- **Plan:** `docs/nightshift/plans/FIXPLAN-FIX-005-nano-for-json.md`
- **Files:** `apps/web/src/lib/cellar/insight.ts` (line 169), `apps/web/src/lib/taste/rationale.ts` (line 109)
- **Summary:** Both `generateCellarInsight` and `generateRationales` use `MODELS.prose` ("gpt-5-mini") with `response_format: { type: "json_object" }`. These are pure structured-extraction tasks (JSON in, JSON out), not prose generation. CLAUDE.md explicitly says to prefer gpt-5-nano where possible. Switching would reduce per-member cost by ~5–10x for these calls.
