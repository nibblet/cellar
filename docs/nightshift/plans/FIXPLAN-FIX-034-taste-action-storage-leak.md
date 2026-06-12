# Fix: [FIX-034] Storage Leak in Pairing Taste Action on DB Insert Failure

## Problem

When a member logs a pairing tasting with an attached photo, if the `product_images`
DB insert fails after the storage upload succeeds, the uploaded file is abandoned in
the `product-photos` bucket with no cleanup. The member sees an error, but the orphaned
file persists forever.

Same class of bug as FIX-003 (capture action — resolved), FIX-021 (product-photo admin
route — planned), FIX-023 (pairing capture action — planned).

## Root Cause

`apps/web/src/app/(app)/(shell)/pairings/[cigarId]/[bourbonId]/taste/actions.ts`
— `submitPairingTaste` action (~line 147).

The photo is uploaded to the `product-photos` bucket (lines ~114–129). On success,
`storagePath` is set. If the subsequent `product_images.insert()` fails (lines ~131–152),
the handler returns `{ status: "error" }` without calling `supabase.storage.from(BUCKET).remove([storagePath])`.

```ts
// Upload succeeds — storagePath is now a real storage object
const { error: uploadError } = await supabase.storage
  .from(BUCKET)
  .upload(storagePath, photo, { ... });
if (uploadError) return { status: "error", ... };

// ...

// DB insert fails — file is abandoned
if (imagesError || !images || images.length !== 2) {
  return { status: "error", message: ... };   // ← storagePath never cleaned up
}
```

## Steps

1. Open `apps/web/src/app/(app)/(shell)/pairings/[cigarId]/[bourbonId]/taste/actions.ts`.

2. Locate the error-return after the `product_images` insert (approximately lines
   131–152). It looks like:
   ```ts
   if (imagesError || !images || images.length !== 2) {
     return { status: "error", message: imagesError?.message ?? "Image record failed." };
   }
   ```

3. Insert a cleanup call before the return:
   ```ts
   if (imagesError || !images || images.length !== 2) {
     if (storagePath) {
       void supabase.storage.from(BUCKET).remove([storagePath]);
     }
     return { status: "error", message: imagesError?.message ?? "Image record failed." };
   }
   ```
   The `void` prefix fires-and-forgets the cleanup without blocking the error response —
   the same pattern used in the resolved FIX-003 and FIX-021.

4. Scan the rest of the action for any other early-return paths that occur after the
   upload succeeds (e.g., the `saveTasting` call or subsequent Supabase writes) and
   apply the same cleanup pattern to each one.

5. Run `pnpm lint` to verify no Biome errors.
6. Run `pnpm build` to verify TypeScript passes.

## Files Modified

- `apps/web/src/app/(app)/(shell)/pairings/[cigarId]/[bourbonId]/taste/actions.ts`
  — add `void supabase.storage.from(BUCKET).remove([storagePath])` before each
  post-upload early-return.

## New Files

None.

## Database Changes

None.

## Verify

- [ ] Build passes
- [ ] Lint passes
- [ ] Simulate DB insert failure (temporarily break the insert table name or RLS) and
  confirm no file appears in the `product-photos` bucket after the error
- [ ] Happy path: photo attached to pairing taste still uploads and associates correctly
