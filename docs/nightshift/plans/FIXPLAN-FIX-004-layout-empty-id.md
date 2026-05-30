# Fix: [FIX-004] Shell layout runs DB query with empty-string user ID

## Problem
In `ShellLayout`, the onboarding check queries the `users` table using:
```tsx
.eq("id", auth.user?.id ?? "")
```
When an unauthenticated request reaches a shell route (possible in edge cases or during session expiry before middleware refresh), `auth.user` is null and the query runs with `id = ""`. Supabase returns no row (no user has an empty UUID), so `profile` is null and `needsOnboarding(null)` is safe — but an unnecessary DB roundtrip fires.

The middleware (`updateSession`) refreshes tokens and should redirect unauthenticated users before reaching the shell layout via the route group, but there is no explicit redirect in the shell layout itself for unauthenticated users.

Impact: minor. One extra DB call per unauthenticated hit on a shell route. More importantly, the auth state is ambiguous at the layout level — the layout implicitly passes through to child pages that each do their own `redirect("/login")`, creating a pattern where the layout's auth check is incomplete.

## Root Cause
`apps/web/src/app/(app)/(shell)/layout.tsx` lines 7–14:
```tsx
const { data: auth } = await supabase.auth.getUser();
const { data: profile } = await supabase
  .from("users")
  .select("onboarding_completed_at")
  .eq("id", auth.user?.id ?? "")  // runs with "" when auth.user is null
  .maybeSingle();
```

## Steps
1. Open `apps/web/src/app/(app)/(shell)/layout.tsx`
2. Add `redirect` import from `next/navigation` (if not already present).
3. Short-circuit after `getUser` if there is no user:
   ```tsx
   const { data: auth } = await supabase.auth.getUser();
   if (!auth.user) redirect("/login");  // prevents empty-string query + makes intent explicit
   
   const { data: profile } = await supabase
     .from("users")
     .select("onboarding_completed_at")
     .eq("id", auth.user.id)  // now guaranteed non-null
     .maybeSingle();
   ```
4. Run `pnpm build`.
5. Run `pnpm lint`.

## Files Modified
- `apps/web/src/app/(app)/(shell)/layout.tsx` — add null guard + redirect before DB query

## New Files (if any)
None.

## Database Changes (if any)
None.

## Verify
- [x] Build passes
- [x] Lint passes
- [ ] Authenticated user navigates to `/` — layout renders normally, no redirect
- [ ] Unauthenticated user navigates to `/` — redirected to `/login` at the layout level (not leaking through to the page)
- [ ] Onboarding redirect still works for a user whose `onboarding_completed_at` is null
