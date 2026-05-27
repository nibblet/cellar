/**
 * Admin catalog-inclusion helpers. The cut-back can leave two rows for the
 * same bottle member-facing when a Cobb-seeded row and a bourbonExplorer row
 * resolve to slightly different `expression` strings (so they never folded).
 *
 * Grouping the member-facing catalog by brand surfaces those side by side; a
 * fuzzy expression key flags the likely duplicates so an admin can hide one.
 */

export type IncludedRow = {
  id: string;
  name: string;
  brand: string | null;
  brand_family: string | null;
  expression: string | null;
};

export type InclusionRow = IncludedRow & { possibleDupe: boolean };
export type InclusionBrandGroup = { brand_family: string; rows: InclusionRow[]; dupeCount: number };

// Dropped when building the fuzzy key — brand boilerplate + spec words that
// vary between sources for the same bottle.
const KEY_STOPWORDS = new Set([
  "the",
  "craft",
  "spirits",
  "company",
  "co",
  "distillery",
  "distilling",
  "kentucky",
  "tennessee",
  "indiana",
  "straight",
  "bourbon",
  "whiskey",
  "whisky",
  "rye",
  "wheat",
  "wheated",
  "proof",
  "aged",
  "year",
  "yr",
  "old",
  "barreled",
]);

/**
 * Reduce an expression to its distinctive tokens: lowercased, brand words and
 * boilerplate removed, numbers dropped, deduped + sorted. Two rows for the same
 * bottle collapse to the same key even when their full names differ.
 */
export function normalizeExpressionKey(brandFamily: string, expression: string | null): string {
  const brandTokens = new Set(brandFamily.toLowerCase().split(/\s+/));
  const tokens = (expression ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !brandTokens.has(t) && !KEY_STOPWORDS.has(t) && !/^\d+$/.test(t));
  return [...new Set(tokens)].sort().join(" ");
}

/**
 * Group member-facing rows by brand family. Within a brand, rows whose fuzzy
 * expression key collides (non-empty) are flagged `possibleDupe`. Brands with
 * any flagged rows sort first so the dupes are easy to find.
 */
export function groupIncludedByBrand(rows: IncludedRow[]): InclusionBrandGroup[] {
  const order: string[] = [];
  const byBrand = new Map<string, IncludedRow[]>();
  for (const r of rows) {
    if (!r.brand_family) continue;
    if (!byBrand.has(r.brand_family)) {
      byBrand.set(r.brand_family, []);
      order.push(r.brand_family);
    }
    byBrand.get(r.brand_family)?.push(r);
  }

  const groups = order.map((bf) => {
    const list = byBrand.get(bf) ?? [];
    const keyCount = new Map<string, number>();
    for (const r of list) {
      const k = normalizeExpressionKey(bf, r.expression);
      if (k) keyCount.set(k, (keyCount.get(k) ?? 0) + 1);
    }
    const annotated: InclusionRow[] = list.map((r) => {
      const k = normalizeExpressionKey(bf, r.expression);
      return { ...r, possibleDupe: k !== "" && (keyCount.get(k) ?? 0) > 1 };
    });
    const dupeCount = annotated.filter((r) => r.possibleDupe).length;
    return { brand_family: bf, rows: annotated, dupeCount };
  });

  return groups.sort(
    (a, b) => b.dupeCount - a.dupeCount || a.brand_family.localeCompare(b.brand_family),
  );
}
