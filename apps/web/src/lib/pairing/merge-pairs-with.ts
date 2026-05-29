import type { PairingCandidate } from "./engine";

export type PairsWithEntry = PairingCandidate & { source: "cellar" | "catalog" };

const CATALOG_CAP = 3;

/**
 * Merge one shelf pick with catalog pairings for the product-detail Pairs with list.
 * Shelf row is first; catalog duplicates are dropped.
 */
export function mergePairsWith(
  shelf: PairingCandidate | null,
  catalog: PairingCandidate[],
): PairsWithEntry[] {
  const merged: PairsWithEntry[] = [];
  const seen = new Set<string>();

  if (shelf) {
    merged.push({ ...shelf, source: "cellar" });
    seen.add(shelf.product_id);
  }

  for (const row of catalog) {
    if (seen.has(row.product_id)) continue;
    merged.push({ ...row, source: "catalog" });
    seen.add(row.product_id);
    if (merged.filter((e) => e.source === "catalog").length >= CATALOG_CAP) break;
  }

  return merged;
}
