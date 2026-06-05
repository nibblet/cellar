# Fix: [FIX-021] Storage Leak on DB Insert Failure in product-photo Route

## Problem
When an admin uploads a member photo via `POST /api/product-photo` with `target=member`, the
storage upload succeeds but a subsequent `product_images` DB insert can fail (constraint
violation, network hiccup, etc.). The uploaded file is then orphaned in the `product-photos`
bucket with no row in `product_images` pointing to it. The storage object will sit there
forever.

Impact: minor for a 12-person club, but creates noise for any future bucket audit and is
unnecessary given the existing cleanup pattern from FIX-003 (now applied in `capture/actions.ts`).

## Root Cause
`apps/web/src/app/api/product-photo/route.ts` lines 109–124.

The member upload path:
1. Uploads to PHOTOS_BUCKET (line 109–114) ← succeeds
2. Inserts into `product_images` (line 116–121)
3. If insert fails (line 122) → returns 500 error **without cleaning up the storage file**

The `capture/actions.ts` pattern (FIX-003) was applied correctly but this parallel code path
was not updated at the same time.

## Steps

1. Open `apps/web/src/app/api/product-photo/route.ts`

2. Find the `insertErr` block at line 122–124:
   ```ts
   if (insertErr) {
     return NextResponse.json({ error: `DB insert failed: ${insertErr.message}` }, { status: 500 });
   }
   ```

3. Add storage cleanup before the early return:
   ```ts
   if (insertErr) {
     void admin.storage.from(PHOTOS_BUCKET).remove([storagePath]);
     return NextResponse.json({ error: `DB insert failed: ${insertErr.message}` }, { status: 500 });
   }
   ```

4. Run `pnpm build` to verify no type errors.
5. Run `pnpm lint` (Biome).

## Files Modified
- `apps/web/src/app/api/product-photo/route.ts` — add `void admin.storage.from(PHOTOS_BUCKET).remove([storagePath])` before the 500 return when DB insert fails

## Verify
- [ ] Build passes
- [ ] Lint passes
- [ ] Code review: storage cleanup is `void`-ed (fire-and-forget is fine — best-effort cleanup, same pattern as capture actions)
- [ ] Confirm no other early-return paths in the member upload block that also leak (catalog target is fine — no separate storage step before the DB update)
