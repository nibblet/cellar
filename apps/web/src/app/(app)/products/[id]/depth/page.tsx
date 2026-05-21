import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Divider, Voice } from "@/components/primitives";
import { TraitRadar } from "@/components/product";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProductType, TraitVector } from "@/lib/wheel";

type Params = Promise<{ id: string }>;

/**
 * Tier 2 #4 — The Depth view (v1). Read-only radar of the product's
 * catalog-baseline `trait_vector` against the 10 pairing axes.
 *
 * Future iterations layer in member adjustments (outlined dots,
 * attributable) and a club-consensus shape (soft moss fill). Both
 * require a new `product_adjustments` table; v1 ships only the visual
 * primitive so the route + affordance + radar component land first.
 */
export default async function ProductDepthPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: product } = await supabase
    .from("products")
    .select("id, type, name, brand, trait_vector")
    .eq("id", id)
    .maybeSingle();

  if (!product) notFound();
  if (!product.trait_vector) notFound();

  const productType = product.type as ProductType;
  const traitVector = product.trait_vector as TraitVector;

  return (
    <main className="mx-auto max-w-md px-5 py-6 pb-24 flex-1">
      <header className="mb-6">
        <Link
          href={`/products/${id}`}
          className="text-[11px] uppercase tracking-widest text-foreground-subtle hover:text-foreground-muted"
        >
          ← Back to the face
        </Link>
        <h1 className="text-3xl mt-2">{product.name}</h1>
        <p className="text-sm text-foreground-muted mt-1">
          {product.brand ? `${product.brand} · ` : ""}
          <span className="uppercase tracking-widest text-foreground-subtle">{productType}</span>
        </p>
      </header>

      <Divider label="The shape" />

      <Card className="py-6">
        <TraitRadar vector={traitVector} label={product.name as string} />
      </Card>

      <Voice className="block mt-5 text-center">
        "Ten axes, sir. The shape is the catalog's read on this one — your own dots and the club's
        consensus will lay over it as members weigh in."
      </Voice>

      <p className="mt-6 text-xs text-foreground-subtle text-center">
        The values come from the silent wheel mapping. Member adjustments + group consensus layer
        onto this baseline in a coming pass.
      </p>
    </main>
  );
}
