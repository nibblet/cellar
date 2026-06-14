# Fix: [FIX-036] welcome/page.tsx fires DB query with empty user ID when unauthenticated

## Problem
`WelcomePage` queries the `users` table with `.eq("id", auth.user?.id ?? "")` before checking whether `auth.user` is non-null. If an unauthenticated visitor reaches `/welcome` (possible mid-invite-flow), the query runs with an empty-string ID, returns null, and the page shows the welcome flow with `firstName = "friend"`. The query is a wasted DB round-trip. Same class as FIX-004 (shell layout, now resolved).

The fix must NOT redirect unauthenticated users — the onboarding page is intentionally accessible without auth because new members follow a magic-link invite flow where auth may not be established yet.

## Root Cause
`apps/web/src/app/(app)/welcome/page.tsx` lines 9–13:
```ts
const { data: auth } = await supabase.auth.getUser();
const { data: profile } = await supabase
  .from("users")
  .select("name_first, onboarding_completed_at")
  .eq("id", auth.user?.id ?? "")   // ← runs even when auth.user is null
  .maybeSingle();
```

## Steps
1. Open `apps/web/src/app/(app)/welcome/page.tsx`
2. Add an early-return path after the auth check that skips the DB query when unauthenticated:
   ```ts
   const { data: auth } = await supabase.auth.getUser();

   // Unauthenticated visitors are in the middle of the invite-accept flow.
   // Skip the profile query — show the welcome screen with a generic greeting.
   if (!auth.user) {
     return (
       <AppShell auth className="py-10 pb-10">
         <WelcomeFlow firstName="friend" />
       </AppShell>
     );
   }

   const { data: profile } = await supabase
     .from("users")
     .select("name_first, onboarding_completed_at")
     .eq("id", auth.user.id)   // ← now safe: auth.user is confirmed non-null
     .maybeSingle();

   if (profile && !needsOnboarding(profile)) {
     redirect("/");
   }

   const firstName = profile?.name_first ?? "friend";
   ```
3. Remove the old `profile &&` guard on line 16 (now covered by the early return).
4. Run `pnpm lint`
5. Run `pnpm build`

## Files Modified
- `apps/web/src/app/(app)/welcome/page.tsx` — add auth guard before DB query; use `auth.user.id` (non-null) in the query

## New Files
None.

## Database Changes
None.

## Verify
- [ ] Build passes
- [ ] Lint passes
- [ ] Unauthenticated request to `/welcome` renders `<WelcomeFlow firstName="friend" />` without a DB query
- [ ] Authenticated member with `onboarding_completed_at` set redirects to `/`
- [ ] Authenticated new member (no `onboarding_completed_at`) sees `<WelcomeFlow firstName={profile.name_first} />`
