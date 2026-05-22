import Link from "next/link";
import { notFound } from "next/navigation";
import { Divider } from "@/components/primitives";
import { ConstructionPanel, FactsStrip, FlavorBarChart } from "@/components/product";
import { buildTagCloud, loadGroupVoice } from "@/lib/aggregation/group-voice";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProductType, WheelVector } from "@/lib/wheel";

type Params = Promise<{ id: string }>;

// Keys surfaced in the Construction panel — excluded from the dense Facts
// strip so values don't repeat.
const CIGAR_CONSTRUCTION_KEYS = [
  "wrapper",
  "wrapper_color",
  "binder",
  "filler",
  "country",
  "vitola",
  "strength",
];
const BOURBON_CONSTRUCTION_KEYS = [
  "distillery",
  "mash_bill",
  "proof",
  "abv",
  "age_years",
  "age_label",
  "style_family",
  "dsp",
];

/**
 * Depth view — full spec table, flavor bar chart, and correction affordance.
 * Accessible whether or not a trait_vector exists; the flavor chart simply
 * shows a placeholder when no tastings have been logged.
 */
export default async function ProductDepthPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: product } = await supabase
    .from("products")
    .select("id, type, name, brand, specs, wheel_vector")
    .eq("id", id)
    .maybeSingle();

  if (!product) notFound();

  const productType = product.type as ProductType;
  const specs = (product.specs ?? {}) as Record<string, unknown>;

  const groupVoice = await loadGroupVoice(supabase, id, productType);

  // Fall back to the catalog baseline (wheel_vector from enrichment) when no
  // member tastings have been logged yet.
  const wheelVector = (product as unknown as { wheel_vector?: WheelVector | null }).wheel_vector;
  const flavorEntries =
    groupVoice.tag_cloud.length > 0
      ? groupVoice.tag_cloud
      : buildTagCloud(productType, wheelVector ? [wheelVector] : []);
  const isBaseline = groupVoice.tag_cloud.length === 0 && flavorEntries.length > 0;

  return (
    <main className="mx-auto max-w-md px-5 py-6 pb-24 flex-1">
      <header className="mb-6">
        <Link
          href={`/products/${id}`}
          className="text-[11px] uppercase tracking-widest text-foreground-subtle hover:text-foreground-muted"
        >
          ← Back
        </Link>
        <h1 className="text-3xl mt-2">{product.name}</h1>
        {product.brand ? (
          <p className="text-sm text-foreground-muted mt-1">
            {product.brand} ·{" "}
            <span className="uppercase tracking-widest text-foreground-subtle">{productType}</span>
          </p>
        ) : null}
      </header>

      <Divider label="Construction" />
      <ConstructionPanel productType={productType} specs={specs} />

      <div className="mt-3">
        <FactsStrip
          productType={productType}
          specs={specs}
          excludeKeys={
            productType === "cigar" ? CIGAR_CONSTRUCTION_KEYS : BOURBON_CONSTRUCTION_KEYS
          }
        />
      </div>

      <Divider label="Flavor profile" />

      {flavorEntries.length > 0 ? (
        <>
          <FlavorBarChart entries={flavorEntries} />
          {isBaseline ? (
            <p className="text-[11px] uppercase tracking-widest text-foreground-subtle mt-3">
              Catalog baseline · Fills in as the club weighs in
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-foreground-subtle">
          No tastings logged yet — the profile fills in as the club weighs in.
        </p>
      )}

      <div className="mt-10 pt-6 border-t border-border">
        <Link
          href={`/products/${id}/edit`}
          className="text-sm text-foreground-subtle hover:text-foreground-muted"
        >
          Spot something wrong? Suggest a correction →
        </Link>
      </div>
    </main>
  );
}
