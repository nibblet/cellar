import type { SupabaseClient } from "@supabase/supabase-js";
import { buildTagCloud } from "@/lib/aggregation/group-voice";
import type { ProductType, WheelVector } from "@/lib/wheel";

export const RECENT_PALATE_PER_TYPE = 3;
export const PALATE_LABELS_PER_PRODUCT = 2;

type RecentProductRow = {
  product_id: string;
  type: ProductType;
  wheel_vector: WheelVector | null;
};

export async function loadRecentPalateTraits(
  supabase: SupabaseClient,
  memberId: string,
): Promise<string[]> {
  const [bourbonIds, cigarIds] = await Promise.all([
    loadRecentTriedProductIds(supabase, memberId, "bourbon", RECENT_PALATE_PER_TYPE),
    loadRecentTriedProductIds(supabase, memberId, "cigar", RECENT_PALATE_PER_TYPE),
  ]);

  const allIds = [...bourbonIds, ...cigarIds];
  if (allIds.length === 0) return [];

  const { data } = await supabase
    .from("products")
    .select("id, type, wheel_vector")
    .in("id", allIds);

  const rows = (
    (data ?? []) as Array<{ id: string; type: ProductType; wheel_vector: WheelVector | null }>
  ).map((row) => ({
    product_id: row.id,
    type: row.type,
    wheel_vector: row.wheel_vector,
  }));

  return buildRecentPalateTraits(rows, { bourbonIds, cigarIds });
}

export function buildRecentPalateTraits(
  products: RecentProductRow[],
  order: { bourbonIds: string[]; cigarIds: string[] },
): string[] {
  const byId = new Map(products.map((product) => [product.product_id, product]));

  const bourbonLabels = order.bourbonIds.map((productId) => labelsForProduct(byId.get(productId)));
  const cigarLabels = order.cigarIds.map((productId) => labelsForProduct(byId.get(productId)));

  return interleaveUniqueLabels(bourbonLabels, cigarLabels);
}

function labelsForProduct(product: RecentProductRow | undefined): string[] {
  if (!product?.wheel_vector || Object.keys(product.wheel_vector).length === 0) return [];

  return buildTagCloud(product.type, [product.wheel_vector], PALATE_LABELS_PER_PRODUCT).map(
    (entry) => formatPalateLabel(entry.label),
  );
}

export function interleaveUniqueLabels(
  bourbonGroups: string[][],
  cigarGroups: string[][],
): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();
  const max = Math.max(bourbonGroups.length, cigarGroups.length);

  for (let index = 0; index < max; index += 1) {
    for (const label of bourbonGroups[index] ?? []) {
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(label);
    }
    for (const label of cigarGroups[index] ?? []) {
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(label);
    }
  }

  return merged;
}

function formatPalateLabel(label: string): string {
  return label.replace(/\b\w/g, (char) => char.toUpperCase());
}

async function loadRecentTriedProductIds(
  supabase: SupabaseClient,
  memberId: string,
  type: ProductType,
  limit: number,
): Promise<string[]> {
  const { data } = await supabase
    .from("member_saves")
    .select("product_id, products!inner(id, type)")
    .eq("member_id", memberId)
    .eq("tried", true)
    .eq("products.type", type)
    .eq("products.catalog_included", true)
    .eq("products.status", "confirmed")
    .order("updated_at", { ascending: false })
    .limit(limit);

  type JoinedRow = {
    product_id: string;
    products: { id: string; type: string } | Array<{ id: string; type: string }>;
  };

  return ((data ?? []) as unknown as JoinedRow[]).map((row) => row.product_id);
}
