import type { SupabaseClient } from "@supabase/supabase-js";
import type { CellarRow, CellarSnapshot } from "./types";
import { EMPTY_SNAPSHOT, ZERO_ROW } from "./types";

/**
 * Load the cellar state for a single (member, product) pair.
 * Returns ZERO_ROW if no row exists.
 */
export async function loadCellarRow(
  supabase: SupabaseClient,
  memberId: string,
  productId: string,
): Promise<CellarRow> {
  const { data } = await supabase
    .from("member_saves")
    .select("have, want, tried, loved")
    .eq("member_id", memberId)
    .eq("product_id", productId)
    .maybeSingle();

  if (!data) return ZERO_ROW;
  const row = data as CellarRow;
  return {
    have: Boolean(row.have),
    want: Boolean(row.want),
    tried: Boolean(row.tried),
    loved: Boolean(row.loved),
  };
}

/**
 * Load all saves for a member as a snapshot of product-id Sets.
 * Used for ranking bias in the pairing engine and Daily Pour.
 */
export async function loadCellarSnapshot(
  supabase: SupabaseClient,
  memberId: string,
): Promise<CellarSnapshot> {
  const { data } = await supabase
    .from("member_saves")
    .select("product_id, have, want, tried, loved")
    .eq("member_id", memberId);

  if (!data || data.length === 0) return EMPTY_SNAPSHOT;

  const snapshot: CellarSnapshot = {
    have: new Set<string>(),
    want: new Set<string>(),
    tried: new Set<string>(),
    loved: new Set<string>(),
  };

  for (const row of data as Array<{
    product_id: string;
    have: boolean;
    want: boolean;
    tried: boolean;
    loved: boolean;
  }>) {
    if (row.have) snapshot.have.add(row.product_id);
    if (row.want) snapshot.want.add(row.product_id);
    if (row.tried) snapshot.tried.add(row.product_id);
    if (row.loved) snapshot.loved.add(row.product_id);
  }

  return snapshot;
}

/**
 * Load all saves for a member filtered to a specific state column.
 * Returns the product_ids in the given state, plus the full row for display.
 */
export async function loadCellarProducts(
  supabase: SupabaseClient,
  memberId: string,
  filter: "have" | "want" | "tried" | "loved",
): Promise<
  Array<{
    product_id: string;
    name: string;
    brand: string | null;
    type: string;
    image_url: string | null;
  }>
> {
  const { data } = await supabase
    .from("member_saves")
    .select("product_id, products!inner(id, name, brand, type, image_url)")
    .eq("member_id", memberId)
    .eq(filter, true)
    .order("updated_at", { ascending: false });

  if (!data) return [];

  type JoinedRow = {
    product_id: string;
    products:
      | { id: string; name: string; brand: string | null; type: string; image_url: string | null }
      | Array<{
          id: string;
          name: string;
          brand: string | null;
          type: string;
          image_url: string | null;
        }>;
  };

  return (data as unknown as JoinedRow[])
    .map((row) => {
      const p = Array.isArray(row.products) ? row.products[0] : row.products;
      return {
        product_id: row.product_id,
        name: p?.name ?? "",
        brand: p?.brand ?? null,
        type: p?.type ?? "",
        image_url: p?.image_url ?? null,
      };
    })
    .filter((r) => r.name);
}

export { EMPTY_SNAPSHOT };
