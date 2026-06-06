# Fix: [FIX-023] Storage leak in pairing capture on sign/identify failure

## Problem
In `pairings/capture/actions.ts`, the `identifyPairingPhoto` action uploads a photo to the
`product-photos` bucket, then calls `createSignedUrl` and `identifyPairFromImage`. If either
of those steps fails, the uploaded file is abandoned in storage without cleanup.

Impact: low for 12 users, but the same class of orphan accumulation as FIX-003 (single
capture — now resolved) and FIX-021 (product-photo admin route — planned). Storage noise
complicates any future bucket audit.

## Root Cause

`apps/web/src/app/(app)/(shell)/pairings/capture/actions.ts` lines ~38–72:

```ts
// Upload succeeds (line ~38)
const { error: uploadError } = await supabase.storage.from(BUCKET).upload(...);
if (uploadError) { return error; }  // No file uploaded yet — fine.

// Signed URL fails — file is already in storage but NOT cleaned up:
const { data: signed, error: signedError } = await supabase.storage
  .from(BUCKET).createSignedUrl(storagePath, 300);
if (signedError || !signed) {
  return { status: "error", message: ... };  // ← FILE LEAKED
}

// Identify fails — file is in storage, not cleaned up:
try {
  const result = await identifyPairFromImage({ ... });
  ...
} catch (err) {
  return { status: "error", message: ... };  // ← FILE LEAKED
}
```

The single-capture action (`capture/actions.ts`) was fixed under FIX-003 with the same
`void supabase.storage.from(BUCKET).remove([storagePath])` pattern before each error return.

## Steps

1. Open `apps/web/src/app/(app)/(shell)/pairings/capture/actions.ts`

2. After the `if (signedError || !signed)` check, add cleanup before the return:

   **Before:**
   ```ts
   if (signedError || !signed) {
     return { status: "error", message: `Could not sign URL: ${signedError?.message}` };
   }
   ```

   **After:**
   ```ts
   if (signedError || !signed) {
     void supabase.storage.from(BUCKET).remove([storagePath]);
     return { status: "error", message: `Could not sign URL: ${signedError?.message}` };
   }
   ```

3. After the `catch (err)` block's error return, add cleanup:

   **Before:**
   ```ts
   } catch (err) {
     const message = err instanceof Error ? err.message : "Couldn't read that photo.";
     return { status: "error", message };
   }
   ```

   **After:**
   ```ts
   } catch (err) {
     void supabase.storage.from(BUCKET).remove([storagePath]);
     const message = err instanceof Error ? err.message : "Couldn't read that photo.";
     return { status: "error", message };
   }
   ```

4. Run `pnpm build` to verify (or manual scan — identical pattern to FIX-003 which is known clean).
5. Run `pnpm lint`.

## Files Modified
- `apps/web/src/app/(app)/(shell)/pairings/capture/actions.ts` — two cleanup lines added

## New Files
None.

## Database Changes
None.

## Verify
- [ ] Build passes
- [ ] Lint passes
- [ ] On dev: trigger a pairing capture with a test photo where the signed URL step is mocked
  to fail — confirm no orphan file left in `product-photos/[userId]/` in Supabase dashboard
- [ ] On dev: trigger a pairing capture where `identifyPairFromImage` fails (disconnect
  internet after upload) — confirm no orphan file
- [ ] Happy path: successful pairing identify still returns `storagePath` in state as before
