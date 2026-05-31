import type { SupabaseClient } from "@supabase/supabase-js";
import { productVisibleWithMaxCatalogTier } from "@/lib/catalog/normalize-specs";
import type { CatalogGroup } from "@/lib/feed/catalog-queries";
import { DEFAULT_MAX_CATALOG_TIER } from "@/lib/preferences/types";
import type { ProductType } from "@/lib/wheel";
import { makerSlug } from "./slug";

export type MakerSummary = {
  slug: string;
  name: string;
  type: ProductType;
  country: string | null;
  house_style: string | null;
  product_count: number;
};

type ProductBrandRow = { brand: string; type: ProductType };
type ProductCatalogRow = {
  brand: string;
  type: ProductType;
  specs: Record<string, unknown> | null;
};

/** Same visibility cut as `loadCatalogBrowse` (catalog_included + member tier). */
export function filterProductsForBrandBrowse(
  products: ProductCatalogRow[],
  maxCatalogTier: number = DEFAULT_MAX_CATALOG_TIER,
): ProductBrandRow[] {
  const rows: ProductBrandRow[] = [];
  for (const p of products) {
    if (!p.brand?.trim()) continue;
    if (!productVisibleWithMaxCatalogTier(p.specs, maxCatalogTier)) continue;
    rows.push({ brand: p.brand.trim(), type: p.type });
  }
  return rows;
}
type MakerMetaRow = {
  slug: string;
  name: string;
  type: ProductType;
  country: string | null;
  house_style: string | null;
};

/**
 * Build maker browse rows from catalog product brands, augmented with `makers` metadata.
 * Counts use `product.brand` (maker page identity), not `brand_family`.
 */
export function buildMakerSummaries(
  products: ProductBrandRow[],
  makers: MakerMetaRow[],
  typeFilter?: ProductType,
): MakerSummary[] {
  const counts = new Map<string, number>();
  for (const p of products) {
    if (!p.brand?.trim()) continue;
    const key = `${p.brand.trim()}\0${p.type}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const makerBySlug = new Map(makers.map((m) => [m.slug, m]));
  const summaries: MakerSummary[] = [];

  for (const [key, product_count] of counts) {
    const sep = key.indexOf("\0");
    const brand = key.slice(0, sep);
    const type = key.slice(sep + 1) as ProductType;
    if (typeFilter && type !== typeFilter) continue;

    const slug = makerSlug(brand);
    const meta = makerBySlug.get(slug);
    summaries.push({
      slug,
      name: meta?.name ?? brand,
      type,
      country: meta?.country ?? null,
      house_style: meta?.house_style ?? null,
      product_count,
    });
  }

  return summaries.sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadMakerSummaries(
  supabase: SupabaseClient,
  type?: ProductType,
  maxCatalogTier: number = DEFAULT_MAX_CATALOG_TIER,
): Promise<MakerSummary[]> {
  const [{ data: products, error: productsError }, { data: makers, error: makersError }] =
    await Promise.all([
      supabase
        .from("products")
        .select("brand, type, specs")
        .eq("status", "confirmed")
        .eq("catalog_included", true)
        .not("brand", "is", null),
      supabase
        .from("makers")
        .select("slug, name, type, country, house_style")
        .order("name", { ascending: true }),
    ]);

  if (productsError) throw productsError;
  if (makersError) throw makersError;

  const catalogRows: ProductCatalogRow[] = [];
  for (const row of products ?? []) {
    const brand = row.brand as string | null;
    if (!brand?.trim()) continue;
    catalogRows.push({
      brand: brand.trim(),
      type: row.type as ProductType,
      specs: (row.specs as Record<string, unknown> | null) ?? null,
    });
  }

  const rows = filterProductsForBrandBrowse(catalogRows, maxCatalogTier);
  return buildMakerSummaries(rows, (makers ?? []) as MakerMetaRow[], type);
}

/**
 * Resolve a maker detail URL slug for a bourbon catalog brand cluster.
 * Prefers `product.brand` on a core-range row; falls back to the divider label.
 */
export function makerSlugForCatalogGroup(group: CatalogGroup): string | null {
  const brand =
    group.entries.find((e) => e.is_core_range && e.brand)?.brand ??
    group.entries.find((e) => e.brand)?.brand ??
    group.brand_family;

  if (!brand?.trim()) return null;
  return makerSlug(brand.trim());
}
