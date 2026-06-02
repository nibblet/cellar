# Dev Plan: [IDEA-003] Phase 9 — Maker & Distillery Pages (Part A)

> **Part B (refinements):** [DEVPLAN-IDEA-003-maker-pages-part-b.md](DEVPLAN-IDEA-003-maker-pages-part-b.md) — structured country/website, fresh `house_style`, admin metadata, manual QA.

## What This Does
Tappable maker/distillery pages keyed by brand name. Each page shows: a Winston blurb (AI-generated, admin-editable), country/region, the club's catalog from that house, and a one-line house-style read derived from aggregating `trait_vector` across the maker's products. Brand names on product detail pages become links to these pages.

For the 12 NCCC members, this turns dead brand text into an explorable surface. Tapping "Confidenciaal" on a product opens a page that tells you Honduras, links to the website, lists every Confidenciaal in the club's catalog, and gives a one-line house-style read pulled from the club's own flavor wheel data — editable by Paul when the AI gets a fact wrong.

Fully specced in `planning/nccc-implementation-plan.md` Phase 9. This plan is the executable form.

## User Stories
- As a member, I want to tap a brand name on a product detail page so that I can see all the club's products from that house and understand what that maker is about.
- As Winston (the club voice), I want to narrate each maker's house style so that the page feels like NCCC, not a generic brand directory.
- As Paul (admin), I want to edit a maker blurb when Winston gets a fact wrong so that accuracy gaps don't stay visible.

## Implementation

### Phase 1: Database Migration
1. Create migration `supabase/migrations/20260530000001_makers.sql`:
   ```sql
   create table public.makers (
     id          uuid primary key default gen_random_uuid(),
     slug        text not null unique,
     name        text not null,
     type        text not null check (type in ('cigar', 'bourbon')),
     country     text,
     website     text,
     blurb       text,
     blurb_source text not null default 'ai' check (blurb_source in ('ai', 'manual')),
     house_style text,  -- one-line derived from trait_vector aggregate
     updated_by  uuid references public.users(id) on delete set null,
     created_at  timestamptz not null default now(),
     updated_at  timestamptz not null default now()
   );
   
   comment on table public.makers is 'Cigar makers and bourbon distilleries. Blurb is AI-generated (Winston), editable by admin.';
   comment on column public.makers.blurb_source is 'ai = regeneration allowed; manual = preserve admin edits';
   
   create index makers_slug_idx on public.makers (slug);
   create index makers_type_idx on public.makers (type);
   
   alter table public.makers enable row level security;
   
   create policy "members read makers"
     on public.makers for select
     to authenticated
     using (true);
   
   create policy "admins manage makers"
     on public.makers for all
     to authenticated
     using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'))
     with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));
   
   -- Trigger: touch updated_at
   create or replace function public.touch_makers_updated_at()
   returns trigger language plpgsql as $$
   begin new.updated_at = now(); return new; end;
   $$;
   create trigger makers_updated_at
     before update on public.makers
     for each row execute function public.touch_makers_updated_at();
   ```
2. Apply: `supabase db push` (manual — Paul applies this).
3. **Checkpoint:** Migration runs without error; `makers` table visible in Supabase dashboard.

### Phase 2: Core Library — House-Style Aggregator
1. Create `apps/web/src/lib/makers/aggregate.ts`:
   ```ts
   import type { TraitVector } from "@/lib/wheel";
   
   /**
    * Aggregate multiple trait vectors into a single average vector.
    * Only traits present in at least half the vectors are included.
    */
   export function aggregateTraitVectors(vectors: TraitVector[]): TraitVector {
     if (vectors.length === 0) return {};
     const sums: Record<string, number> = {};
     const counts: Record<string, number> = {};
     for (const v of vectors) {
       for (const [k, val] of Object.entries(v)) {
         sums[k] = (sums[k] ?? 0) + val;
         counts[k] = (counts[k] ?? 0) + 1;
       }
     }
     const result: TraitVector = {};
     const threshold = vectors.length / 2;
     for (const k of Object.keys(sums)) {
       if (counts[k] >= threshold) {
         result[k as keyof TraitVector] = sums[k] / vectors.length;
       }
     }
     return result;
   }
   ```
2. Create `apps/web/src/lib/makers/house-style.ts`:
   ```ts
   import type { PairingTrait, TraitVector } from "@/lib/wheel";
   import { dominantTraits } from "@/lib/taste/vector";
   
   /**
    * Derive a one-line house-style read from an aggregated trait vector.
    * e.g. "Leans medium-full: cedar, leather, cocoa."
    */
   export function deriveHouseStyleLine(vector: TraitVector, makerName: string): string {
     const traits = dominantTraits(vector);
     if (traits.length === 0) return "";
     const [primary, ...rest] = traits;
     const tagline = rest.length > 0
       ? `${primary}, ${rest.slice(0, 2).join(", ")}`
       : primary;
     return `${makerName} leans ${tagline}.`;
   }
   ```
3. Write unit tests for both in `apps/web/src/lib/makers/aggregate.test.ts` and `house-style.test.ts`.
4. Run `pnpm test` to confirm.
5. **Checkpoint:** Tests pass; aggregator correctly averages trait vectors.

### Phase 3: Maker Slug Utility + Seeding Helper
1. Create `apps/web/src/lib/makers/slug.ts`:
   ```ts
   /** Stable URL-safe slug from a brand name. e.g. "Oliva Cigar" → "oliva-cigar" */
   export function makerSlug(brand: string): string {
     return brand
       .toLowerCase()
       .replace(/[^a-z0-9]+/g, "-")
       .replace(/^-+|-+$/g, "");
   }
   ```
2. The makers table is seeded on demand (when a maker page is first visited) rather than upfront — this avoids a one-time migration of ~100 brand names. On first page visit, if no `makers` row exists for the slug, create one via `upsert` with `blurb: null` and regenerate.
3. **Checkpoint:** `makerSlug("Oliva Cigar")` → `"oliva-cigar"`.

### Phase 4: Winston Blurb Generator
1. Create `apps/web/src/lib/makers/blurb.ts` — Winston maker blurb generator via OpenAI:
   ```ts
   import { MODELS, openai } from "@/lib/openai/client";
   import { estimateCost, logUsage } from "@/lib/usage/log";
   
   const SYSTEM_PROMPT = `You are Winston, the resident narrator at the Norton Commons Cigar Club...
   
   You are writing a brief maker profile for a cigar maker or bourbon distillery. One paragraph, 2-3 sentences. Give: where they operate, what they're known for, and their general house character in flavor terms. Ground it in facts — region, family history if notable, signature expressions. Warm and specific; never a press release.
   
   Rules: Plain prose, no markdown, no bullets. Do NOT sign off. Do NOT fabricate quotes or specific award claims you're not certain about.
   `;
   
   export async function generateMakerBlurb(
     name: string,
     type: "cigar" | "bourbon",
     supabase: SupabaseClient,
     userId: string | null,
   ): Promise<string> {
     const userMessage = `MAKER: ${name}\nTYPE: ${type}`;
     const completion = await openai().chat.completions.create({
       model: MODELS.prose,
       reasoning_effort: "minimal",
       response_format: { type: "text" },
       messages: [
         { role: "system", content: SYSTEM_PROMPT },
         { role: "user", content: userMessage },
       ],
     });
     // ... log usage, clean output, return
   }
   ```
2. Use `MODELS.prose` (gpt-5-mini) here — maker blurbs are real prose and quality matters.
3. **Checkpoint:** `generateMakerBlurb("Oliva Cigar", "cigar", ...)` returns 2-3 sentences.

### Phase 5: `ensureMaker` Load Function
1. Create `apps/web/src/lib/makers/load.ts`:
   ```ts
   export async function ensureMaker(
     supabase: SupabaseClient,
     brand: string,
     type: "cigar" | "bourbon",
     userId: string | null,
   ): Promise<MakerRow> {
     const slug = makerSlug(brand);
     
     // 1. Look up existing row
     const { data: existing } = await supabase
       .from("makers")
       .select("*")
       .eq("slug", slug)
       .maybeSingle();
     
     if (existing && existing.blurb) return existing;
     
     // 2. Load the maker's catalog products to derive house-style
     const { data: products } = await supabase
       .from("products")
       .select("id, name, trait_vector")
       .eq("brand", brand)
       .eq("type", type)
       .eq("status", "confirmed")
       .eq("catalog_included", true)
       .not("trait_vector", "is", null);
     
     const vectors = (products ?? [])
       .map(p => p.trait_vector)
       .filter(Boolean) as TraitVector[];
     const aggregated = aggregateTraitVectors(vectors);
     const houseStyle = vectors.length >= 2
       ? deriveHouseStyleLine(aggregated, brand)
       : null;
     
     // 3. Generate blurb if needed (only if blurb_source is 'ai' or row doesn't exist)
     let blurb = existing?.blurb ?? null;
     if (!blurb) {
       try {
         blurb = await generateMakerBlurb(brand, type, supabase, userId);
       } catch {
         blurb = null; // page renders without blurb rather than erroring
       }
     }
     
     // 4. Upsert (admin client required — users can't write makers via RLS)
     // NOTE: this means ensureMaker on a page requires passing an admin client
     // OR we use an API route for the upsert. Simplest: admin client in server component.
     const { data: upserted } = await supabase
       .from("makers")
       .upsert({ slug, name: brand, type, blurb, house_style: houseStyle }, { onConflict: "slug" })
       .select()
       .single();
     
     return upserted ?? { slug, name: brand, type, blurb, house_style: houseStyle };
   }
   ```
   **Important:** The upsert to `makers` requires admin RLS bypass OR a service-role client. Use `createSupabaseAdminClient()` for the write path inside a server component. Read path uses the regular server client.
2. **Checkpoint:** Visiting a new maker page creates a row in the `makers` table.

### Phase 6: Maker Page Route
1. Create `apps/web/src/app/(app)/(shell)/makers/[slug]/page.tsx`:
   ```tsx
   type Params = Promise<{ slug: string }>;
   
   export default async function MakerPage({ params }: { params: Params }) {
     const { slug } = await params;
     const supabase = await createSupabaseServerClient();
     const { data: auth } = await supabase.auth.getUser();
     if (!auth.user) redirect("/login");
     
     // Load maker row (create if first visit)
     const maker = await ensureMaker(supabase, ...);
     if (!maker) notFound();
     
     // Load catalog from this maker
     const { data: products } = await supabase
       .from("products")
       .select("id, name, image_url, type, specs")
       .eq("brand", maker.name)
       .eq("type", maker.type)
       .eq("status", "confirmed")
       .eq("catalog_included", true)
       .order("name", { ascending: true });
     
     // Sign image paths
     const signed = await signImagePaths(supabase, ...);
     
     return (
       <AppShell>
         <header className="mb-6">
           <p className="text-sm tracking-widest uppercase text-foreground-subtle">
             {maker.type === "cigar" ? "Cigar Maker" : "Distillery"}
           </p>
           <h1 className="text-3xl mt-1">{maker.name}</h1>
           {maker.country ? (
             <p className="text-sm text-foreground-muted mt-1">{maker.country}</p>
           ) : null}
           {maker.house_style ? (
             <p className="text-sm text-moss-500 mt-2 uppercase tracking-widest text-[11px]">
               {maker.house_style}
             </p>
           ) : null}
         </header>
         
         {maker.blurb ? (
           <>
             <Divider label="Winston's take" />
             <WinstonTastingNote text={maker.blurb} />
           </>
         ) : null}
         
         <Divider label="In the club's catalog" />
         <div className="flex flex-col gap-3">
           {(products ?? []).map(p => (
             <CatalogCard key={p.id} entry={p} signedHero={...} cellarState={null} />
           ))}
         </div>
         
         {isAdmin ? <MakerAdminActions maker={maker} /> : null}
       </AppShell>
     );
   }
   ```
2. **Checkpoint:** `/makers/oliva-cigar` renders with blurb, house style, and catalog list.

### Phase 7: Cross-Link from Product Detail
1. In `apps/web/src/app/(app)/(shell)/products/[id]/page.tsx`, change the brand display in the product header:
   ```tsx
   // Before:
   <p className="text-[11px] uppercase tracking-widest text-foreground-subtle mb-2">
     {product.brand}
   </p>
   
   // After:
   <Link
     href={`/makers/${makerSlug(product.brand)}`}
     className="text-[11px] uppercase tracking-widest text-foreground-subtle mb-2 hover:text-foreground transition-colors"
   >
     {product.brand}
   </Link>
   ```
2. Import `makerSlug` from `@/lib/makers/slug`.
3. **Checkpoint:** Tapping the brand name on a product detail navigates to the maker page.

### Phase 8: Admin Edit
1. Create `apps/web/src/app/(app)/(shell)/makers/[slug]/admin-actions.ts` — server action to update blurb:
   ```ts
   export async function updateMakerBlurb(slug: string, blurb: string): Promise<void> {
     // requireAdminSupabase check
     // admin client upsert: blurb, blurb_source: "manual", updated_by: userId
   }
   export async function regenerateMakerBlurb(slug: string): Promise<void> {
     // requireAdminSupabase check
     // only if blurb_source === 'ai' — don't clobber manual edits
     // regenerate via generateMakerBlurb, write back
   }
   ```
2. `MakerAdminActions` client component: inline edit textarea + save button, plus a "Regenerate" button (only enabled when `blurb_source === 'ai'`).
3. **Checkpoint:** Paul can edit the Oliva blurb, save it, and it persists. Regenerate button is disabled after a manual edit.

## AI / Embedding Considerations
- Maker blurb: `gpt-5-mini` (prose, quality matters). Generated once on first visit, cached in DB.
- No per-page-load AI calls — blurb served from `makers.blurb`.
- House-style: pure in-process computation (aggregateTraitVectors + deriveHouseStyleLine). $0 cost.
- Fallback: if blurb generation fails on first visit, page renders without blurb section (no error thrown to user).

## Design System Compliance
- Single brass action: none on this page (navigation only).
- Winston via `<WinstonTastingNote />` for the blurb — permitted context (editorial / intro).
- Etched `<Divider />` at every section break.
- `formatMemberName` not needed (no member rendering).
- Flavor wheel: house-style line from `deriveHouseStyleLine` is plain text, not a slider.

## Mobile Constraints
- Catalog list: same `CatalogCard` used on the main catalog tab — already mobile-optimized.
- Brand link on product detail: `text-[11px]` tap target may be small. If needed, wrap in a `block py-1` to increase touch area.
- No new bottom-nav entry needed — accessed via product detail cross-link only.

## Database / RLS
- Migration: `supabase/migrations/20260530000001_makers.sql` (see Phase 1)
- `makers` table: members read, admins write (enforced by RLS)
- Admin client used only for `makers` upsert inside `ensureMaker` (trusted server context)
- Applied via `supabase db push` — manual by Paul

## Testing
- [x] `pnpm build` passes
- [x] `pnpm lint` passes (changed files clean)
- [x] `pnpm test` — aggregator and house-style unit tests pass
- [ ] `/makers/oliva-cigar` renders with Winston blurb + catalog list
- [ ] Product detail brand → link navigates to maker page
- [ ] Maker page with no catalog products shows empty state (Winston empty-state line)
- [ ] Admin: edit blurb → `blurb_source` flips to `manual`, regenerate button disables
- [ ] Admin: regenerate only works when `blurb_source === 'ai'`
- [ ] Mobile viewport (375px): header + blurb visible without scrolling

## Dependencies
- `catalog_hierarchy` migration already applied (20260527000001) — provides brand grouping
- `trait_vector` populated for catalog products (ongoing via enrichment pipeline)
- Phase 1 migration (`makers` table) must be applied before anything else

## Estimated Total: 4–6 hours
