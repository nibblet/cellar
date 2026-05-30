import type { SupabaseClient } from "@supabase/supabase-js";

export type PickerProduct = {
  id: string;
  name: string;
  brand: string | null;
};

export async function loadPickerProductById(
  supabase: SupabaseClient,
  productId: string,
): Promise<PickerProduct | null> {
  const { data } = await supabase
    .from("products")
    .select("id, name, brand")
    .eq("id", productId)
    .eq("status", "confirmed")
    .maybeSingle();

  return (data as PickerProduct | null) ?? null;
}
