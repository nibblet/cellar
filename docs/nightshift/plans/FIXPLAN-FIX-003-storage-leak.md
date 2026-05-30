# Fix: [FIX-003] Storage object leaked on signed-URL failure during capture

## Problem
In the capture server action, a photo is uploaded to the `product-photos` bucket (line 38–41). If the subsequent `createSignedUrl` call fails (lines 48–54), the action returns an error to the user — but the uploaded file is never deleted. The orphaned object accumulates in storage with no associated product row.

For 12 users this is low-urgency, but any bucket audit or cost review will show phantom files and confuse any future cleanup script.

## Root Cause
`apps/web/src/app/(app)/(shell)/capture/actions.ts` lines 43–67:
```ts
if (uploadError) {
  return { status: "error", message: `Upload failed: ${uploadError.message}` };
}

const { data: signed, error: signedError } = await supabase.storage
  .from(BUCKET)
  .createSignedUrl(storagePath, 300);

if (signedError || !signed) {
  // BUG: file is in storage but we return here without cleaning up
  return { status: "error", message: `Could not sign URL: ${signedError?.message}` };
}
```

Additionally, if `identifyAndPersist` throws (line 65–68), the file is already uploaded and again never cleaned up.

## Steps
1. Open `apps/web/src/app/(app)/(shell)/capture/actions.ts`
2. Add a cleanup helper (inline is fine — this file is the only caller):
   ```ts
   async function cleanupOrphan(supabase: ..., bucket: string, path: string): Promise<void> {
     await supabase.storage.from(bucket).remove([path]);
   }
   ```
3. After the `signedError` early return block, add cleanup:
   ```ts
   if (signedError || !signed) {
     void supabase.storage.from(BUCKET).remove([storagePath]);
     return { status: "error", message: `Could not sign URL: ${signedError?.message}` };
   }
   ```
4. Wrap the `identifyAndPersist` call similarly:
   ```ts
   try {
     outcome = await identifyAndPersist({ ... });
   } catch (err) {
     void supabase.storage.from(BUCKET).remove([storagePath]);
     const message = err instanceof Error ? err.message : "Identification failed.";
     return { status: "error", message };
   }
   ```
5. The `remove()` call is fire-and-forget (`void`) — we don't block the error return on it. If the cleanup itself fails, the behavior is the same as today (orphaned file), which is acceptable; at least we tried.
6. Run `pnpm build`.
7. Run `pnpm lint`.

## Files Modified
- `apps/web/src/app/(app)/(shell)/capture/actions.ts` — add storage cleanup on sign-URL failure and on identifyAndPersist failure

## New Files (if any)
None.

## Database Changes (if any)
None.

## Verify
- [ ] Build passes
- [ ] Lint passes
- [ ] Happy path capture still works (file stays in storage after success)
- [ ] (Manual simulation): if you temporarily break createSignedUrl (e.g., pass a bad bucket name), confirm the file is removed from storage rather than left behind
