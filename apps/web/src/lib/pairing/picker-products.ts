import type { SupabaseClient } from "@supabase/supabase-js";

export type PickerProduct = {
  id: string;
  name: string;
  brand: string | null;
};

export async function loadPickerProducts(
  supabase: SupabaseClient,
  productType: "cigar" | "bourbon",
  limit = 120,
): Promise<PickerProduct[]> {
  const { data } = await supabase
    .from("products")
    .select("id, name, brand")
    .eq("type", productType)
    .eq("status", "confirmed")
    .order("name")
    .limit(limit);

  return (data as PickerProduct[] | null) ?? [];
}

export function filterPickerProducts(products: PickerProduct[], query: string): PickerProduct[] {
  const q = query.trim().toLowerCase();
  if (!q) return products;
  return products.filter(
    (p) => p.name.toLowerCase().includes(q) || (p.brand?.toLowerCase().includes(q) ?? false),
  );
}
