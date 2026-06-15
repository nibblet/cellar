# Fix: [FIX-040] enrich-draft route missing creator/admin ownership check

## Problem

Any authenticated club member can call `POST /api/enrich-draft` with any `productId` and trigger
Apify web scraping + OpenAI enrichment on any unconfirmed product they didn't create — consuming
API budget and overwriting AI-curated specs/wheel_vector on another member's draft.

Impact: low for 12 trusted friends in practice, but the authorization gap is inconsistent with the
rest of the app (all other write operations check creator or admin), and the Apify + OpenAI cost
can be non-trivial if exploited intentionally or by accident.

## Root Cause

`apps/web/src/app/api/enrich-draft/route.ts` lines 35–44:

```typescript
if (force || imageOnly) {
  // admin check runs here
}
```

The admin/admin check is gated behind `force || imageOnly`. When neither flag is set (the common
case: a member's own product detail page auto-fires enrichment on page load), there is NO
ownership verification. The code fetches the product via the user's RLS client (correct), then
passes it to `enrichDraftProduct(product, admin)` using the service-role `admin` client (bypassing
RLS for writes). Any member who knows a product UUID can hit this endpoint and trigger enrichment.

The `productNeedsCatalogEnrichment()` guard at lines 59–75 mitigates this by skipping products
that are already enriched — but any product that legitimately needs enrichment (e.g., a draft
captured by another member) can be enriched by anyone.

## Steps

1. Open `apps/web/src/app/api/enrich-draft/route.ts`

2. After line 54 (after the `if (error || !product)` guard), add an ownership check:

```typescript
// Before:
const specs = (product.specs ?? {}) as Record<string, unknown>;

// After:
if (!force && !imageOnly) {
  // Only the product's creator or an admin may trigger enrichment.
  if (product.created_by !== auth.user.id) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  }
}

const specs = (product.specs ?? {}) as Record<string, unknown>;
```

3. Update the product SELECT at line 48 to include `created_by` (it's currently missing):

```typescript
// Before:
.select("id, type, name, brand, line, source, image_url, specs, wheel_vector")

// After:
.select("id, type, name, brand, line, source, image_url, specs, wheel_vector, created_by")
```

4. Run `pnpm build` to verify

5. Run `pnpm lint`

6. Test: POST `/api/enrich-draft` as member A with the productId of a draft created by member B.
   Before fix: 200 OK (enrichment fires). After fix: 403 (not authorized).

## Files Modified

- `apps/web/src/app/api/enrich-draft/route.ts` — add `created_by` to SELECT, add ownership gate
  after the product-fetch guard

## New Files (if any)

None.

## Database Changes (if any)

None. `created_by` is an existing column on `products`.

## Verify

- [ ] Build passes
- [ ] Lint passes
- [ ] POST as creator: still triggers enrichment (200 OK)
- [ ] POST as admin: still triggers enrichment (200 OK) even for other members' products
- [ ] POST as non-creator, non-admin: returns 403
- [ ] `force=true` path: admin-only gate still works as before (unchanged)
