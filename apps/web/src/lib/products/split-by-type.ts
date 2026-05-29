import type { SupabaseClient } from "@supabase/supabase-js";

export type ProductTypeRow = { id: string; type: string };

/** Split product ids into cigar vs bourbon lists (stable name order). */
export function splitIdsByProductType(rows: ProductTypeRow[]): {
  cigars: string[];
  bourbons: string[];
} {
  const cigars: string[] = [];
  const bourbons: string[] = [];
  for (const row of rows) {
    if (row.type === "cigar") cigars.push(row.id);
    else if (row.type === "bourbon") bourbons.push(row.id);
  }
  return { cigars, bourbons };
}

export async function loadProductTypes(
  supabase: SupabaseClient,
  ids: Set<string>,
): Promise<ProductTypeRow[]> {
  if (ids.size === 0) return [];

  const { data } = await supabase
    .from("products")
    .select("id, type")
    .in("id", [...ids]);

  return (data as ProductTypeRow[] | null) ?? [];
}
