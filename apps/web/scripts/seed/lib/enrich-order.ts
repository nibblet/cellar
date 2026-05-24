import { normalizeCobbTier } from "@/lib/catalog/normalize-specs";
import type { ProductType } from "@/lib/wheel";

export type EnrichOrder = "created" | "updated" | "name" | "tier";

/** Sort key for untiered rows — after full tier pass, stragglers run last. */
const UNTIERED_SORT = 99;

export function tierSortKey(specs: Record<string, unknown> | null | undefined): number {
  return normalizeCobbTier(specs) ?? UNTIERED_SORT;
}

export function sortByTier<T extends { specs: Record<string, unknown> | null; name?: string }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const byTier = tierSortKey(a.specs) - tierSortKey(b.specs);
    if (byTier !== 0) return byTier;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });
}

export function parseEnrichOrder(argv: string[], productType: ProductType): EnrichOrder {
  const i = argv.indexOf("--order");
  const raw = i >= 0 ? argv[i + 1] : undefined;
  if (raw === "created" || raw === "updated" || raw === "name" || raw === "tier") return raw;
  return productType === "bourbon" ? "tier" : "created";
}

/** Widen fetch when tier-sorting in memory so the limit slice is meaningful. */
export function tierOrderFetchLimit(requested: number): number {
  return Math.min(Math.max(requested * 10, requested), 500);
}
