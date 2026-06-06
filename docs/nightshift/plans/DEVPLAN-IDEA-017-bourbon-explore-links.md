# Dev Plan: [IDEA-017] Bourbon-specific explore links on product detail

## What This Does
The `ExploreLinks` component currently exposes two external research links (CigarPage, Cigar
Aficionado) and is already type-guarded so it only renders on cigar product detail pages. Bourbon
product detail has no equivalent "Explore" section.

Adding a `productType` prop to `ExploreLinks` and a parallel set of bourbon-specific links
(Whiskybase and Distiller.com) gives members a direct research path when hunting a bourbon they
just found in the catalog. No AI cost. No DB changes. No new routes.

## User Stories
- As a member browsing a bourbon product, I want to jump straight to Whiskybase or Distiller.com
  so I can read community ratings and check availability without leaving the context of NCCC.
- As a cigar member, I want the existing CigarPage and Cigar Aficionado links to be unchanged.

## Implementation

### Phase 1: Update `ExploreLinks` component

1. Open `apps/web/src/components/product/explore-links.tsx`

2. Add `productType: "cigar" | "bourbon"` to the props type:

   **Before:**
   ```ts
   type ExploreLinksProps = {
     brand: string | null;
     name: string;
   };
   ```

   **After:**
   ```ts
   type ExploreLinksProps = {
     brand: string | null;
     name: string;
     productType: "cigar" | "bourbon";
   };
   ```

3. Replace the hardcoded `LINKS` constant with a type-keyed map:

   **Before:**
   ```ts
   const LINKS = [
     {
       label: "Check CigarPage for deals",
       buildUrl: (q: string) =>
         `https://www.cigarpage.com/catalogsearch/result/?q=${q}`,
     },
     {
       label: "Cigar Aficionado ratings",
       buildUrl: (q: string) =>
         `https://www.cigaraficionado.com/ratings/search?q=${q}`,
     },
   ] as const;
   ```

   **After:**
   ```ts
   const CIGAR_LINKS = [
     {
       label: "Check CigarPage for deals",
       buildUrl: (q: string) =>
         `https://www.cigarpage.com/catalogsearch/result/?q=${q}`,
     },
     {
       label: "Cigar Aficionado ratings",
       buildUrl: (q: string) =>
         `https://www.cigaraficionado.com/ratings/search?q=${q}`,
     },
   ] as const;

   const BOURBON_LINKS = [
     {
       label: "Whiskybase ratings",
       buildUrl: (q: string) =>
         `https://www.whiskybase.com/search?q=${q}`,
     },
     {
       label: "Distiller.com community notes",
       buildUrl: (q: string) =>
         `https://distiller.com/search?q=${q}`,
     },
   ] as const;
   ```

4. Update the function signature and link selection:

   **Before:**
   ```ts
   export function ExploreLinks({ brand, name }: ExploreLinksProps) {
     const q = buildSearchQuery(brand, name);
     return (
       <div className="mt-8">
         <Divider label="Explore" />
         <div className="mt-3 flex flex-col gap-3">
           {LINKS.map((link) => (
             ...
           ))}
         </div>
       </div>
     );
   }
   ```

   **After:**
   ```ts
   export function ExploreLinks({ brand, name, productType }: ExploreLinksProps) {
     const q = buildSearchQuery(brand, name);
     const links = productType === "bourbon" ? BOURBON_LINKS : CIGAR_LINKS;
     return (
       <div className="mt-8">
         <Divider label="Explore" />
         <div className="mt-3 flex flex-col gap-3">
           {links.map((link) => (
             ...
           ))}
         </div>
       </div>
     );
   }
   ```

   **Checkpoint:** TypeScript compiles — the `productType` prop is required, and the correct
   link set renders per type.

### Phase 2: Update product detail page

1. Open `apps/web/src/app/(app)/(shell)/products/[id]/page.tsx`

2. Find the `ExploreLinks` usage (currently cigar-only guard around line 293):

   **Before:**
   ```tsx
   {productType === "cigar" ? (
     <div className="mt-6">
       <ExploreLinks brand={product.brand ?? null} name={product.name} />
     </div>
   ) : null}
   ```

   **After:**
   ```tsx
   <div className="mt-6">
     <ExploreLinks
       brand={product.brand ?? null}
       name={product.name}
       productType={productType}
     />
   </div>
   ```

   Note: the type-guard moves into `ExploreLinks` itself (which now accepts both types), so
   the wrapping conditional can be removed. Bourbon products now render the Explore section.

   **Checkpoint:** Visit a cigar product detail — CigarPage and Cigar Aficionado links show.
   Visit a bourbon product detail — Whiskybase and Distiller links show.

3. Run `pnpm build` — verify no TypeScript errors.
4. Run `pnpm lint`.

## AI / Embedding Considerations
None — pure static links, zero AI cost.

## Design System Compliance
- Single brass action unaffected (ExploreLinks uses ghost/muted links, not brass)
- Winston not involved
- Etched `<Divider label="Explore" />` already present — unchanged
- No flavor wheel rendered
- No member name display
- `formatMemberName` not involved

## Mobile Constraints
- Links open in a new tab (target="_blank") — standard iPhone behavior in PWA
- One-handed: external links are in the lower scroll area, not competing with primary CTAs
- The section sits at the bottom of product detail, below all primary club-voice content

## Database / RLS
None.

## Testing
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] Open a cigar product detail → "Explore" section shows CigarPage + Cigar Aficionado links
- [ ] Open a bourbon product detail → "Explore" section shows Whiskybase + Distiller links
- [ ] Each link opens in a new tab with the product name pre-filled in the search query
- [ ] TypeScript strict: no implicit `any` in the props type

## Dependencies
None.

## Estimated Total: 30 minutes
