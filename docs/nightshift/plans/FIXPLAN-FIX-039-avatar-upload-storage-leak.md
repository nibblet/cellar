# Fix: [FIX-039] Storage leak in avatar upload action on DB update failure

## Problem
In `uploadAvatar` (you/settings/actions.ts), if the storage upload succeeds but the `users.avatar_url` DB update fails, the function returns an error to the member but leaves the uploaded file orphaned in the `avatars` bucket. Same class as FIX-003 (capture — resolved), FIX-021, FIX-023, FIX-034.

The severity is lower than product-photo leaks because:
- The avatar storage path is deterministic: `{userId}/avatar.{ext}` — at most one file per extension per user.
- A subsequent successful upload with the same extension silently replaces it.
- However, if the user's extension changes (jpg → png), the old file is never cleaned up.

For 12 members with rare avatar updates, accumulation is minimal — but the pattern is inconsistent with the rest of the codebase and should be closed.

## Root Cause
`apps/web/src/app/(app)/(shell)/you/settings/actions.ts` lines 70–81:
```ts
const { error: uploadError } = await supabase.storage
  .from("avatars")
  .upload(path, file, { upsert: true, contentType: file.type });

if (uploadError) return { ok: false, message: uploadError.message };

const { error: dbError } = await supabase
  .from("users")
  .update({ avatar_url: path })
  .eq("id", auth.user.id);

if (dbError) return { ok: false, message: dbError.message };
// ← uploaded file at `path` is orphaned on dbError
```

## Steps
1. Open `apps/web/src/app/(app)/(shell)/you/settings/actions.ts`
2. Replace the `dbError` check (lines 77–81) with a cleanup-before-return:
   ```ts
   const { error: dbError } = await supabase
     .from("users")
     .update({ avatar_url: path })
     .eq("id", auth.user.id);

   if (dbError) {
     // Storage already succeeded — clean up the orphaned file before returning the error.
     void supabase.storage.from("avatars").remove([path]);
     return { ok: false, message: dbError.message };
   }
   ```
3. Run `pnpm lint`
4. Run `pnpm build`

## Files Modified
- `apps/web/src/app/(app)/(shell)/you/settings/actions.ts` — add storage cleanup before dbError return

## New Files
None.

## Database Changes
None.

## Verify
- [ ] Build passes
- [ ] Lint passes
- [ ] Happy path: avatar uploads and DB record updates — no behavior change
- [ ] On simulated DB failure: storage.remove fires (no orphaned file); member sees error message
