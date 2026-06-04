# Fix: [FIX-018] Missing admin auth in roadmap suggestion management actions

## Problem
`updateSuggestionStatus` and `deleteSuggestion` in `apps/web/src/app/(app)/(shell)/roadmap/actions.ts` have no app-layer authentication or admin role check. Any authenticated member can call these server actions to change or delete any suggestion. RLS on the `suggestions` table enforces admin-only update/delete, so the DB rejects non-admin attempts, but the caller receives a raw Postgres RLS error instead of a friendly message. Defense-in-depth is absent — same pattern as FIX-002 (now resolved on invites).

## Root Cause
`roadmap/actions.ts` houses `submitSuggestion` (member write — correct, auth checked) and the admin mutations `updateSuggestionStatus` / `deleteSuggestion` (no auth check). The file grew organically; admin mutations were added without adding the `requireAdminSupabase()` guard already used by `admin/catalog/actions.ts` and `admin/meetup/actions.ts`.

## Steps

1. Open `apps/web/src/app/(app)/(shell)/roadmap/actions.ts`

2. Add a private `requireAdminSupabase` helper after the imports (before `VALID_KINDS`):
```ts
async function requireAdminSupabase() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { supabase: null, error: "Not signed in." as const };

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profile?.role !== "admin") return { supabase: null, error: "Not authorized." as const };
  return { supabase, error: null };
}
```

3. Replace the body of `updateSuggestionStatus` — swap the bare `createSupabaseServerClient()` call for the admin guard:

Before:
```ts
  if (!id || !status) return { status: "error", message: "Bad request." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("suggestions").update({ status }).eq("id", id);
```

After:
```ts
  if (!id || !status) return { status: "error", message: "Bad request." };

  const { supabase, error: authError } = await requireAdminSupabase();
  if (!supabase) return { status: "error", message: authError };

  const { error } = await supabase.from("suggestions").update({ status }).eq("id", id);
```

4. Replace the body of `deleteSuggestion` the same way:

Before:
```ts
  if (!id) return { status: "error", message: "Missing id." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("suggestions").delete().eq("id", id);
```

After:
```ts
  if (!id) return { status: "error", message: "Missing id." };

  const { supabase, error: authError } = await requireAdminSupabase();
  if (!supabase) return { status: "error", message: authError };

  const { error } = await supabase.from("suggestions").delete().eq("id", id);
```

5. Run `pnpm lint` from `apps/web/`
6. Run `pnpm build` from `apps/web/`

## Files Modified
- `apps/web/src/app/(app)/(shell)/roadmap/actions.ts` — add `requireAdminSupabase` helper; add auth guard in `updateSuggestionStatus` and `deleteSuggestion`

## New Files
None.

## Database Changes
None. RLS already correct; this adds the app-layer guard.

## Verify
- [ ] Build passes
- [ ] Lint passes
- [ ] As a non-admin member, calling `updateSuggestionStatus` returns `{ status: "error", message: "Not authorized." }` (not a raw DB error)
- [ ] As a non-admin member, calling `deleteSuggestion` returns `{ status: "error", message: "Not authorized." }`
- [ ] As an admin, both still work
