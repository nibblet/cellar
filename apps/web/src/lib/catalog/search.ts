import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductType } from "@/lib/wheel";

export type CatalogSearchResult = {
  id: string;
  name: string;
  brand: string | null;
  type: ProductType;
};

export type CatalogSearchOptions = {
  query: string;
  type?: ProductType | "all";
  limit?: number;
};

/** Strip characters that break PostgREST `.or()` filter syntax. */
export function sanitizeCatalogQuery(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9 .'\-&]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function isCatalogSearchReady(query: string): boolean {
  return sanitizeCatalogQuery(query).length >= 2;
}

/** Server-side catalog search — same ilike semantics as the Lounge search page. */
export async function searchCatalogProducts(
  supabase: SupabaseClient,
  options: CatalogSearchOptions,
): Promise<CatalogSearchResult[]> {
  const sanitized = sanitizeCatalogQuery(options.query);
  if (sanitized.length < 2) return [];

  const { type = "all", limit = 60 } = options;

  let query = supabase
    .from("products")
    .select("id, name, brand, type")
    .eq("status", "confirmed")
    .or(`name.ilike.%${sanitized}%,brand.ilike.%${sanitized}%`)
    .order("name", { ascending: true })
    .limit(limit);

  if (type !== "all") query = query.eq("type", type);

  const { data } = await query;
  return (data as CatalogSearchResult[] | null) ?? [];
}
