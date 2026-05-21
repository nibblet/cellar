import type { SupabaseClient } from "@supabase/supabase-js";
import { rollUpTraits } from "@/lib/wheel/traits";
import type { ProductType, WheelVector } from "@/lib/wheel/types";

/**
 * Compute a product's wheel_vector + trait_vector from the union of its
 * members' tasting wheel_vectors (max per leaf — mirrors the merge convention
 * used by the bourbon dedupe pass).
 *
 * Only fills products that have no trait_vector yet. Seeded catalog entries
 * already carry curated vectors derived from review descriptors; overwriting
 * them with the first one or two member tastings would be noisier than the
 * baseline. This intervention is for the gap case: drafts created via capture
 * and any confirmed products the seed missed.
 */
export async function backfillProductVectorIfMissing(
  supabase: SupabaseClient,
  productId: string,
): Promise<void> {
  const { data: product } = await supabase
    .from("products")
    .select("type, trait_vector")
    .eq("id", productId)
    .maybeSingle();

  if (!product) return;
  if (product.trait_vector !== null) return;

  const { data: rows } = await supabase
    .from("tastings")
    .select("wheel_vector")
    .eq("product_id", productId)
    .not("wheel_vector", "is", null);

  const merged: WheelVector = {};
  for (const r of rows ?? []) {
    const v = (r.wheel_vector ?? {}) as WheelVector;
    for (const [leaf, score] of Object.entries(v)) {
      if (typeof score !== "number") continue;
      if (merged[leaf] === undefined || score > merged[leaf]) merged[leaf] = score;
    }
  }

  if (Object.keys(merged).length === 0) return;

  const traits = rollUpTraits(product.type as ProductType, merged);

  await supabase
    .from("products")
    .update({ wheel_vector: merged, trait_vector: traits })
    .eq("id", productId);
}
