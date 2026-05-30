"use server";

import { searchCatalogProducts } from "@/lib/catalog/search";
import type { PickerProduct } from "@/lib/pairing/picker-products";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function searchPickerProducts(
  query: string,
  productType: "cigar" | "bourbon",
): Promise<PickerProduct[]> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

  const results = await searchCatalogProducts(supabase, {
    query,
    type: productType,
    limit: 60,
  });

  return results.map(({ id, name, brand }) => ({ id, name, brand }));
}
