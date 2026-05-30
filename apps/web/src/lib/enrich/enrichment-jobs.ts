import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductType } from "@/lib/wheel";
import { productNeedsCatalogEnrichment } from "./needs-enrichment";

export type EnrichmentJob = {
  productId: string;
  productType: ProductType;
};

/**
 * Products from a pairing save that still need the async Apify/specs pass.
 */
export async function loadEnrichmentJobsForProducts(
  supabase: SupabaseClient,
  productIds: string[],
): Promise<EnrichmentJob[]> {
  const unique = [...new Set(productIds.filter(Boolean))];
  if (unique.length === 0) return [];

  const { data: products } = await supabase
    .from("products")
    .select("id, type, source, specs, wheel_vector")
    .in("id", unique);

  if (!products?.length) return [];

  const { data: reviewRows } = await supabase
    .from("product_reviews")
    .select("product_id")
    .in("product_id", unique);

  const reviewCountByProduct = new Map<string, number>();
  for (const row of reviewRows ?? []) {
    reviewCountByProduct.set(row.product_id, (reviewCountByProduct.get(row.product_id) ?? 0) + 1);
  }

  const jobs: EnrichmentJob[] = [];

  for (const product of products) {
    const productType = product.type as ProductType;
    const specs = (product.specs ?? {}) as Record<string, unknown>;
    const wheelVector = (product.wheel_vector ?? null) as Record<string, number> | null;

    if (
      productNeedsCatalogEnrichment({
        productType,
        source: product.source,
        specs,
        reviewCount: reviewCountByProduct.get(product.id) ?? 0,
        hasWheelVector: wheelVector != null && Object.keys(wheelVector).length > 0,
      })
    ) {
      jobs.push({ productId: product.id, productType });
    }
  }

  return jobs;
}
