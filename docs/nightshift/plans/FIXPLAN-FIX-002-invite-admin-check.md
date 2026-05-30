# Fix: [FIX-002] Missing app-layer admin check in invite server actions

## Problem
`createInvite` and `revokeInvite` in the admin invites server actions only verify that the caller is authenticated (`getUser`), not that they are an admin. A non-admin member who calls these actions directly receives a raw Supabase RLS error (e.g., "new row violates row-level security policy") rather than a friendly "Not authorized" message.

Impact: RLS is the real gate (the DB will reject unauthorized writes), so there is no actual security hole. But the error UX is broken — a non-admin sees an opaque DB error instead of a clear rejection. Also, relying solely on RLS for authorization conflicts with the pattern established by every other admin action (`admin/catalog/actions.ts`, `admin/meetup/actions.ts`, `products/[id]/reroll-actions.ts`).

## Root Cause
`apps/web/src/app/(app)/(shell)/admin/invites/actions.ts` — neither `createInvite` nor `revokeInvite` calls a `requireAdminSupabase()` helper (or equivalent) before executing the DB write.

## Steps
1. Open `apps/web/src/app/(app)/(shell)/admin/invites/actions.ts`
2. Add a `requireAdminSupabase` helper at the top (after the import block), matching the pattern used in `admin/catalog/actions.ts`:
   ```ts
   async function requireAdminSupabase(): Promise<
     | { supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>; error: null }
     | { supabase: null; error: string }
   > {
     const supabase = await createSupabaseServerClient();
     const { data: auth } = await supabase.auth.getUser();
     if (!auth.user) return { supabase: null, error: "Not signed in." };
   
     const { data: profile } = await supabase
       .from("users")
       .select("role")
       .eq("id", auth.user.id)
       .maybeSingle();
   
     if (profile?.role !== "admin") return { supabase: null, error: "Not authorized." };
     return { supabase, error: null };
   }
   ```
3. Update `createInvite`:
   ```ts
   // Before:
   export async function createInvite(...) {
     const supabase = await createSupabaseServerClient();
     const { data: auth } = await supabase.auth.getUser();
     if (!auth.user) return { status: "error", message: "Not signed in." };
     ...
   }
   
   // After:
   export async function createInvite(...) {
     const { supabase, error: authError } = await requireAdminSupabase();
     if (!supabase) return { status: "error", message: authError };
     ...
   }
   ```
   Also remove the now-redundant `auth` usage; use `supabase` directly for the insert. Note: `created_by` needs the user ID — retrieve it separately after auth:
   ```ts
   const { data: { user } } = await supabase.auth.getUser();
   // user is guaranteed non-null here since requireAdminSupabase confirmed auth
   ```
4. Update `revokeInvite` similarly — replace the inline `createSupabaseServerClient` + `getUser` block with `requireAdminSupabase`.
5. Run `pnpm build`.
6. Run `pnpm lint`.

## Files Modified
- `apps/web/src/app/(app)/(shell)/admin/invites/actions.ts` — add `requireAdminSupabase` helper, use it in both actions

## New Files (if any)
None.

## Database Changes (if any)
None.

## Verify
- [ ] Build passes
- [ ] Lint passes
- [ ] As admin: creating an invite still works — token appears
- [ ] As admin: revoking an invite still works
- [ ] (Manual / test): calling `createInvite` as a non-admin returns `{ status: "error", message: "Not authorized." }` rather than a DB error
