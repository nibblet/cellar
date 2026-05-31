# Dev Plan: [IDEA-005] Makers browse page

## What This Does
Adds a `/makers` list page that shows all cigar makers and bourbon distilleries whose products
are in the NCCC catalog. Members can tap any maker to navigate to the Phase 9 maker detail page.
Without this, maker pages are only reachable by tapping a brand name on a product detail page —
there's no way to discover "what makers do we have in the catalog?"

For a club of 12 who care about provenance and house character, browsing by maker is a natural
navigation pattern. It completes the Phase 9 investment: the detail pages exist but the front
door doesn't.

## User Stories
- As a member, I want to browse all cigar makers and distilleries in the catalog so I can explore
  by house.
- As a member, I want to see how many products each maker has in the catalog so I know which
  houses have deep representation.
- As Winston (the club voice), I want this surface to feel like a cellar card catalog, not a
  database table.

## Implementation

### Phase 1: Data query
1. Create `apps/web/src/lib/makers/browse.ts`:
   ```ts
   export type MakerSummary = {
     slug: string;
     name: string;
     type: ProductType;
     country: string | null;
     house_style: string | null;
     product_count: number;
   };

   export async function loadMakerSummaries(
     supabase: SupabaseClient,
     type?: ProductType,
   ): Promise<MakerSummary[]>
   ```
   - Query: `makers` table joined with a count of `products` where `status='confirmed'`
     and `catalog_included=true` and `brand = makers.name` (or add a `product_count` column
     to the makers table — see note below).
   - Actually the simplest approach: query `products` grouped by `brand`+`type` to get counts,
     then join with `makers` for the rest. Two queries: one for counts, one for maker rows.
   - Sort: by `name` ASC within each type group.
   - Alternative: use a `loadCatalogBrowse`-style brand aggregation since products already have
     `brand` and `type` — build the summary list from products and augment with `makers` rows
     where they exist.

   **Recommended approach** (avoids a complex join):
   ```ts
   // Step 1: load all confirmed/included products, group by brand+type
   const products = await supabase.from("products")
     .select("brand, type")
     .eq("status", "confirmed")
     .eq("catalog_included", true)
     .not("brand", "is", null);

   // Build count map: "brand:type" → count
   const counts = new Map<string, number>();
   for (const p of products.data ?? []) {
     const key = `${p.brand}:${p.type}`;
     counts.set(key, (counts.get(key) ?? 0) + 1);
   }

   // Step 2: load makers rows
   const { data: makerRows } = await supabase.from("makers").select("*")
     .order("name", { ascending: true });

   // Build summaries, falling back to brand-only rows for makers not yet in makers table
   // ...
   ```

2. **Checkpoint:** Unit test `loadMakerSummaries` with fixture data.

### Phase 2: Page
1. Create `apps/web/src/app/(app)/(shell)/makers/page.tsx`:
   - Server component, requires auth
   - Uses `loadMakerSummaries(supabase)` for both cigars and bourbons
   - Renders two sections: `<Divider label="CIGAR MAKERS" />` and `<Divider label="DISTILLERIES" />`
   - Each maker: a card with `name`, `country` (if set), `house_style` (if set), product count

2. Maker card JSX (no separate component needed for 12 makers):
   ```tsx
   <Link href={`/makers/${summary.slug}`} className="...">
     <div className="flex items-start justify-between gap-3">
       <div>
         <p className="font-medium">{summary.name}</p>
         {summary.country ? (
           <p className="text-sm text-foreground-muted">{summary.country}</p>
         ) : null}
         {summary.house_style ? (
           <p className="text-[11px] uppercase tracking-widest text-foreground-subtle mt-1">
             {summary.house_style}
           </p>
         ) : null}
       </div>
       <p className="text-sm text-foreground-muted shrink-0">
         {summary.product_count} {summary.product_count === 1 ? "product" : "products"}
       </p>
     </div>
   </Link>
   ```

3. Empty state: `<Voice>` for "No makers cataloged yet."

4. **Checkpoint:** Navigate to `/makers` — two-section list renders, all makers clickable.

### Phase 3: Navigation entry point
1. Add a "Makers" link somewhere discoverable. Options (pick one):
   - Add to the catalog browse page header (simple link below the cigars/bourbons tab bar)
   - Add to `/you` hub as a nav shortcut
   - Add as a footer link in product detail when `product.brand` is set (next to the existing
     maker brand link): "See all [brand] products →"

   **Recommended:** Add to the catalog browse page header. The browse page already has tabs; a
   small "Makers" link below the tabs (right-aligned, text-foreground-muted) is unobtrusive and
   contextually correct.

2. Find `apps/web/src/app/(app)/(shell)/page.tsx` (the feed/catalog page) and add the link in
   the catalog tab section header.

3. **Checkpoint:** Link is visible in catalog, navigates to `/makers`.

## AI / Embedding Considerations
None — this is pure DB aggregation. No AI calls, no tokens.

## Design System Compliance
- No brass buttons — no primary action needed on the browse page
- Winston: only if the page is empty (empty state voice)
- Etched dividers between cigar makers and distilleries
- Flavor wheel: not rendered
- `formatMemberName`: not applicable (maker names, not member names)
- Moss: not used (no pairing validation context)

## Mobile Constraints
- Each maker card should be finger-tap-sized (min 44px height)
- List should scroll naturally; no horizontal scroll
- Country + house_style are optional — layout should not break without them

## Database / RLS
- No migration needed — reads `makers` table (already has RLS: members read, admins manage)
- `products` table already has member read policy

## Testing
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (add unit test for `loadMakerSummaries` in `lib/makers/browse.test.ts`)
- [ ] `/makers` shows cigar makers and distilleries with product counts
- [ ] Empty sections show Winston voice (if one type has no makers)
- [ ] Tapping a maker navigates to `/makers/[slug]`
- [ ] Mobile viewport verified (iPhone SE / 375px width)

## Dependencies
- Requires Phase 9 maker pages to be built (already done in `makers/[slug]/page.tsx`)

## Estimated Total: 1.5–2 hours
