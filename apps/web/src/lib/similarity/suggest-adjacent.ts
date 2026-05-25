import type { SupabaseClient } from "@supabase/supabase-js";
import { rollUpTraits } from "@/lib/wheel/traits";
import type { ProductType, TraitVector, WheelVector } from "@/lib/wheel";
import { cosineSimilarity } from "./cosine";

export type AdjacentProduct = {
  product_id: string;
  name: string;
  brand: string | null;
  similarity: number;
};

type ProductRow = {
  id: string;
  name: string;
  brand: string | null;
  type: ProductType;
  trait_vector: TraitVector | null;
  wheel_vector: WheelVector | null;
};

/**
 * Same-category recommendations by trait-vector cosine similarity.
 * Cigar → similar cigars; bourbon → similar bourbons.
 */
export async function suggestAdjacentProducts(
  supabase: SupabaseClient,
  sourceProductId: string,
  options: { limit?: number; minSimilarity?: number } = {},
): Promise<AdjacentProduct[]> {
  const { limit = 3, minSimilarity = 0.45 } = options;

  const { data: source } = await supabase
    .from("products")
    .select("id, type, trait_vector, wheel_vector")
    .eq("id", sourceProductId)
    .maybeSingle();

  if (!source) return [];

  const sourceVec = resolveTraitVector(source as ProductRow);
  if (!sourceVec) return [];

  const productType = source.type as ProductType;

  const { data: candidates } = await supabase
    .from("products")
    .select("id, name, brand, type, trait_vector, wheel_vector")
    .eq("type", productType)
    .eq("status", "confirmed")
    .neq("id", sourceProductId);

  if (!candidates) return [];

  const scored = (candidates as ProductRow[])
    .map((c) => {
      const candidateVec = resolveTraitVector(c);
      if (!candidateVec) return null;
      const similarity = cosineSimilarity(sourceVec, candidateVec);
      return {
        product_id: c.id,
        name: c.name,
        brand: c.brand,
        similarity,
      } satisfies AdjacentProduct;
    })
    .filter((c): c is AdjacentProduct => c !== null && c.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return scored;
}

function resolveTraitVector(row: ProductRow): TraitVector | null {
  if (row.trait_vector) return row.trait_vector;
  if (row.wheel_vector && Object.keys(row.wheel_vector).length > 0) {
    return rollUpTraits(row.type, row.wheel_vector);
  }
  return null;
}
