# Dev Plan: [IDEA-022] Admin Product Merge Tool

## What This Does

As more members snap photos of products, the DB will accumulate duplicate `products` rows for the
same bourbon or cigar — two UUIDs representing the same bottle, each holding partial tastings,
cellar saves, and images. There is currently no admin mechanism to fix this.

An `/admin/products/merge` page gives Paul a single-screen tool: pick the primary product (keep),
pick the secondary (archive), click Merge. The action re-parents all tastings and saves from the
secondary to the primary, copies secondary images, and marks the secondary as `archived`. No
data is deleted — the secondary product row stays as an archived record.

For 12 active members snapping photos at meetups, duplicates will accumulate naturally. This tool
closes the catalog hygiene loop without requiring direct SQL access.

## User Stories

- As Paul (admin), I want to merge two duplicate product rows so that all tastings and cellar
  saves are unified under a single canonical product detail page.
- As a member, I want to see a single product page with the full club voice, not a split view
  where tastings are divided across two incomplete records.
- As Winston (the club voice), I want my prose generated against the full tasting history of a
  product, not a partial subset split across duplicates.

## Implementation

### Phase 1: Route + Form

1. Create `apps/web/src/app/(app)/(shell)/admin/products/` directory.
2. Create `apps/web/src/app/(app)/(shell)/admin/products/merge/page.tsx` as a Server Component:
   - Fetch all `confirmed` + `draft` products for the search pickers.
   - Two search-select inputs: Primary product (keep) and Secondary product (archive).
   - A Submit button (brass, disabled until both are chosen and `primary !== secondary`).
   - Winston `<Voice />` warning: "Merging is irreversible — the secondary is archived, not deleted.
     Double-check both products before confirming."
   - Use `<Divider label="MERGE PRODUCTS" />` at the top.
3. Create `apps/web/src/app/(app)/(shell)/admin/products/merge/actions.ts`:
   - `mergeProducts(formData: FormData)` server action
   - Extract `primaryId` and `secondaryId` from formData
   - Call `requireAdminUserId(supabase)` at the top (same pattern as other admin actions)
   - Guard: if `primaryId === secondaryId`, return error "Cannot merge a product with itself"

4. Add a link to the merge tool on `/admin/page.tsx` alongside existing admin links.

**Checkpoint:** Page renders with two product pickers and a merge button. Admin auth guard in place.

### Phase 2: Merge Logic

In `mergeProducts` server action, execute in order (use the Supabase admin client since some
operations may cross member ownership boundaries):

1. **Re-parent tastings:**
   ```sql
   UPDATE tastings SET product_id = primaryId WHERE product_id = secondaryId
   ```
   Via: `admin.from("tastings").update({ product_id: primaryId }).eq("product_id", secondaryId)`

2. **Merge `member_saves`** (per-member OR of each flag):
   - Fetch all `member_saves` rows for both primary and secondary: two queries.
   - For each member who has secondary saves:
     - If they have a primary row: upsert with `have = primary.have OR secondary.have`,
       `want = primary.want OR secondary.want`, `tried = primary.tried OR secondary.tried`,
       `loved = primary.loved OR secondary.loved`.
     - If they have no primary row: update their existing secondary row to point to primary.
   - Delete all remaining secondary `member_saves` rows.
   - Note: use the admin client for these writes since they touch other members' rows.

3. **Move `product_images`:**
   ```sql
   UPDATE product_images SET product_id = primaryId WHERE product_id = secondaryId
   ```
   Via: `admin.from("product_images").update({ product_id: primaryId }).eq("product_id", secondaryId)`

4. **Invalidate `pairings_cache`** — the secondary product may have cache rows on either side:
   ```sql
   DELETE FROM pairings_cache WHERE cigar_id = secondaryId OR bourbon_id = secondaryId
   ```

5. **Archive the secondary product:**
   ```sql
   UPDATE products SET status = 'archived' WHERE id = secondaryId
   ```

6. **Invalidate Winston prose on primary** — the tasting count changed; force a reroll:
   ```sql
   UPDATE products SET winston_prose = null WHERE id = primaryId
   ```

7. Redirect to `/products/${primaryId}` with a `?merged=1` query param so the page can show
   a success toast or Winston confirmation voice line.

**Checkpoint:** Execute a test merge in dev with two known duplicate products. Verify:
- All secondary tastings now appear on the primary product detail page.
- Member cellar toggles on the primary product reflect the merged saves.
- The secondary product page shows status = archived (or 404 if archived products are excluded).
- Pairings recompute on next view of the primary product.

### Phase 3: Polish

1. On `/products/[id]/page.tsx`: if `searchParams.merged === "1"`, render a Winston `<Voice />`
   banner: "Merged. All tastings now live here." (Wrap in a `<Suspense>` or pass as a prop
   from the page to a client-toast component — your choice; the simplest is a small `<Voice />`
   block shown only when the param is present.)

2. On `/admin/products/merge/page.tsx`: use `useActionState` on the form and show actionable
   error messages for:
   - "Product not found" (invalid UUID)
   - "Cannot merge a product with itself"
   - "Both products must be the same type" — guard against merging a cigar with a bourbon

3. Add a `type` mismatch guard in `mergeProducts`:
   - Fetch `type` for both products; return error if they differ.

4. Optional: add a pre-merge preview section showing tasting counts and image counts for each
   product before the button is enabled. Helps Paul confirm he's merging the right pair.

**Checkpoint:** Full merge flow from form → action → redirect → success voice line.

## AI / Embedding Considerations

None. Pure database operations. No AI cost. Winston prose invalidation (Step 6) means the next
view of the primary product detail will re-generate Winston prose via the existing `winston_prose`
generation path — that single GPT-5 mini call fires lazily on the next product detail render.

## Design System Compliance

- Single brass action confirmed (the Merge submit button)
- Winston `<Voice />` used as system/warning message and empty-state — allowed contexts
- `<Divider label="MERGE PRODUCTS" />` at section break
- Flavor wheel: not involved
- `formatMemberName`: not needed (admin-only UI, showing product names not member names)

## Mobile Constraints

Admin tools are Paul-only (iPhone or desktop). The merge form needs two product pickers —
consider a search-style text input with a dropdown (same pattern as capture's `SearchPicker`)
rather than a full-page modal. One-handed use on iPhone: keep the form vertical, one picker per
row, brass merge button at the bottom.

## Database / RLS

No migration needed — `status = 'archived'` is an existing value (alongside `draft` and
`confirmed`). The admin client bypasses RLS for the cross-member `member_saves` operations.

Verify that the `products` table does not have a `status` check constraint that would reject
`'archived'`. If it does, add a migration:
```sql
-- Only if current constraint is CHECK (status IN ('draft', 'confirmed'))
alter table products drop constraint products_status_check;
alter table products add constraint products_status_check
  check (status in ('draft', 'confirmed', 'archived'));
```
Note: applied via `supabase db push` (manual by Paul).

## Testing

- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] Admin auth guard blocks non-admin members (returns "Not authorized")
- [ ] Type mismatch guard rejects merging cigar + bourbon
- [ ] Self-merge guard rejects same UUID in both pickers
- [ ] Tastings count on primary product equals sum of both before merge
- [ ] Member cellar toggles correctly OR-merged (member who had `have` on secondary now shows `have` on primary)
- [ ] Secondary product shows `status: archived` in admin catalog list
- [ ] Pairings recompute on next view of primary product
- [ ] Winston prose regenerates on next view of primary product

## Dependencies

Requires `requireAdminUserId` helper (already in `lib/supabase/` or admin action pattern from
`admin/catalog/actions.ts`). No other dependencies.

## Estimated Total: 2 hours
