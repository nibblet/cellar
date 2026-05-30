import type { SupabaseClient } from "@supabase/supabase-js";
import type { IdentifiedProduct } from "@/lib/openai/identify";
import type { ProductType } from "@/lib/wheel";

/**
 * Create a draft catalog row from vision extraction when fuzzy match misses.
 */
export async function createDraftProduct(
  supabase: SupabaseClient,
  userId: string,
  type: ProductType,
  extracted: Pick<IdentifiedProduct, "name" | "brand" | "specs">,
): Promise<string> {
  const { data: created, error } = await supabase
    .from("products")
    .insert({
      type,
      name: extracted.name,
      brand: extracted.brand,
      specs: extracted.specs,
      status: "draft",
      source: "ai",
      created_by: userId,
    })
    .select("id")
    .single();

  if (error || !created) {
    throw new Error(`Failed to create draft product: ${error?.message ?? "no row returned"}`);
  }

  return created.id;
}
