import type { SupabaseClient } from "@supabase/supabase-js";
import { productMatchesPreferences } from "@/lib/preferences/match";
import { hasAnyPreferences, type MemberPreferences } from "@/lib/preferences/types";
import type { ProductType } from "@/lib/wheel";

export type CatalogEntry = {
  product_id: string;
  name: string;
  brand: string | null;
  type: ProductType;
  hero_image_path: string | null;
  matches_preferences: boolean;
};

type ProductRow = {
  id: string;
  name: string;
  brand: string | null;
  type: ProductType;
  specs: Record<string, unknown> | null;
};

/**
 * Load a catalog-browse slice for the Cigars / Bourbons tabs.
 *
 * Ranking:
 *   1. When the viewer has any preferences, products that match come first
 *      (in the natural order Postgres returns them, no extra scoring).
 *   2. Then the rest in catalog order.
 *
 * Pagination is intentionally lightweight: pull a single page of `limit`
 * rows from each side. For 12 members tasting a few hundred bottles each,
 * scrolling more than 100 entries on these tabs is unlikely and a paginator
 * adds complexity we don't need yet.
 */
export async function loadCatalogBrowse(
  supabase: SupabaseClient,
  type: ProductType,
  preferences: MemberPreferences | null,
  limit = 100,
): Promise<CatalogEntry[]> {
  const { data: rows } = await supabase
    .from("products")
    .select("id, name, brand, type, specs")
    .eq("type", type)
    .eq("status", "confirmed")
    .order("name", { ascending: true })
    .limit(limit);

  const products = ((rows ?? []) as ProductRow[]).filter((p) => Boolean(p.name));
  if (products.length === 0) return [];

  // Batch-fetch hero images.
  const productIds = products.map((p) => p.id);
  const { data: heroes } = await supabase
    .from("product_images")
    .select("product_id, image_url, is_hero, created_at")
    .in("product_id", productIds)
    .order("is_hero", { ascending: false })
    .order("created_at", { ascending: false });

  const heroByProduct = new Map<string, string>();
  for (const h of heroes ?? []) {
    if (!heroByProduct.has(h.product_id)) heroByProduct.set(h.product_id, h.image_url);
  }

  const matchesEnabled = preferences != null && hasAnyPreferences(preferences);

  const entries: CatalogEntry[] = products.map((p) => ({
    product_id: p.id,
    name: p.name,
    brand: p.brand,
    type: p.type,
    hero_image_path: heroByProduct.get(p.id) ?? null,
    matches_preferences:
      matchesEnabled && preferences
        ? productMatchesPreferences({ type: p.type, specs: p.specs }, preferences)
        : false,
  }));

  // Stable sort: matches first, then preserve catalog order.
  if (matchesEnabled) {
    entries.sort((a, b) => {
      if (a.matches_preferences === b.matches_preferences) return 0;
      return a.matches_preferences ? -1 : 1;
    });
  }

  return entries;
}
