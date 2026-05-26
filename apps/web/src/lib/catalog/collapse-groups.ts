/**
 * Group bourbon catalog rows into collapse candidates — shared by seed scripts
 * and the admin catalog review UI.
 */

export type CatalogProductRow = {
  id: string;
  name: string;
  brand: string | null;
  specs: Record<string, unknown> | null;
  release_pattern: string | null;
};

export type CollapseMapEntry = {
  old_product_id: string;
  new_product_id: string;
  old_name: string;
  expression_name: string;
  release_label: string | null;
  expression_chip?: string;
  vintages_matter?: boolean;
  release_pattern?: "year" | "batch" | "pick";
};

export type CollapseVariant = {
  product: CatalogProductRow;
  releaseLabel: string | null;
};

export type CollapseGroup = {
  expressionKey: string;
  expressionName: string;
  brand: string | null;
  survivor: CatalogProductRow;
  variants: CollapseVariant[];
  releasePattern: "year" | "batch" | "pick" | null;
  previewLabels: string[];
};

export type SkippedCollapseGroup = {
  name: string;
  reason: string;
  productCount: number;
};

export type SoloCollapseFlag = {
  product: CatalogProductRow;
  reason: string;
};

export type CollapseAnalysis = {
  groups: CollapseGroup[];
  skipped: SkippedCollapseGroup[];
  soloFlags: SoloCollapseFlag[];
  entries: CollapseMapEntry[];
  stats: {
    totalProducts: number;
    collapseFlagged: number;
    mergeVariants: number;
    expressionGroups: number;
  };
};

function specStr(specs: Record<string, unknown> | null, key: string): string | null {
  const v = specs?.[key];
  if (v === null || v === undefined || v === "") return null;
  return String(v).trim() || null;
}

function releaseLabelFor(p: CatalogProductRow): string | null {
  const fromSpecs =
    specStr(p.specs, "curation_release_label") ??
    (p.specs?.year_made != null ? String(p.specs.year_made) : null) ??
    (p.specs?.release_year != null ? String(p.specs.release_year) : null);
  if (fromSpecs) return fromSpecs;

  const yearInName = p.name.match(/\b(19|20)\d{2}\b/);
  if (yearInName) return yearInName[0];

  return null;
}

export function expressionIdentityKey(p: CatalogProductRow): string {
  const curated = specStr(p.specs, "curated_expression") ?? "";
  const exprType = specStr(p.specs, "expression_type") ?? "";
  return `${p.name}::${curated}::${exprType}`;
}

export function isCollapseFlagged(product: { specs: Record<string, unknown> | null }): boolean {
  return product.specs?.curation_collapse === "Y" || product.specs?.curation_collapse === true;
}

function collapseFlag(p: CatalogProductRow): boolean {
  return isCollapseFlagged(p);
}

function survivorScore(p: CatalogProductRow): number {
  let score = 0;
  if (specStr(p.specs, "curated_expression")) score += 4;
  if (specStr(p.specs, "curation_release_label")) score += 2;
  if (p.specs?.year_made != null) score += 1;
  if (p.specs?.tier != null) score += 1;
  return score;
}

function pickSurvivor(rows: CatalogProductRow[]): CatalogProductRow {
  const sorted = [...rows].sort(
    (a, b) => survivorScore(b) - survivorScore(a) || a.id.localeCompare(b.id),
  );
  const survivor = sorted[0];
  if (!survivor) throw new Error("pickSurvivor called with empty rows");
  return survivor;
}

function inferReleasePattern(labels: string[]): "year" | "batch" | "pick" | null {
  if (labels.length === 0) return null;
  if (labels.every((l) => /^\d{4}$/.test(l))) return "year";
  if (labels.some((l) => /batch|#/i.test(l))) return "batch";
  if (labels.some((l) => /pick|barrel|#/i.test(l))) return "pick";
  return null;
}

export function buildCollapseAnalysis(products: CatalogProductRow[]): CollapseAnalysis {
  const entries: CollapseMapEntry[] = [];
  const skipped: SkippedCollapseGroup[] = [];
  const groups: CollapseGroup[] = [];
  const soloFlags: SoloCollapseFlag[] = [];

  const byExpression = new Map<string, CatalogProductRow[]>();
  for (const p of products) {
    const key = expressionIdentityKey(p);
    const list = byExpression.get(key) ?? [];
    list.push(p);
    byExpression.set(key, list);
  }

  for (const [key, rows] of byExpression) {
    const first = rows[0];
    if (!first) continue;
    const name = first.name;
    const collapsible = rows.filter(collapseFlag);

    if (rows.length < 2) {
      const solo = collapsible[0];
      if (collapsible.length === 1 && solo) {
        soloFlags.push({
          product: solo,
          reason: "collapse flagged but no matching sibling rows",
        });
      }
      continue;
    }

    if (collapsible.length < 2) {
      const solo = collapsible[0];
      if (collapsible.length === 1 && solo) {
        soloFlags.push({
          product: solo,
          reason: "only one row flagged in a multi-row expression group",
        });
      }
      skipped.push({
        name: `${name} (${key})`,
        reason:
          collapsible.length === 0
            ? "no rows flagged curation_collapse=Y"
            : "only one row flagged curation_collapse=Y",
        productCount: rows.length,
      });
      continue;
    }

    const mixedExpressions = new Set(
      collapsible.map(
        (p) =>
          `${specStr(p.specs, "curated_expression") ?? ""}::${specStr(p.specs, "expression_type") ?? ""}`,
      ),
    );
    if (mixedExpressions.size > 1) {
      skipped.push({
        name,
        reason: "mixed curated_expression / expression_type within collapse group",
        productCount: collapsible.length,
      });
      continue;
    }

    const survivor = pickSurvivor(collapsible);
    const variants = collapsible.filter((p) => p.id !== survivor.id);
    const labels: string[] = [];
    const variantViews: CollapseVariant[] = [];

    for (const p of variants) {
      const release = releaseLabelFor(p);
      if (release) labels.push(release);
      variantViews.push({ product: p, releaseLabel: release });
      const chip = specStr(p.specs, "curated_expression");
      entries.push({
        old_product_id: p.id,
        new_product_id: survivor.id,
        old_name: p.name,
        expression_name: name,
        release_label: release,
        expression_chip:
          chip && chip !== specStr(survivor.specs, "curated_expression") ? chip : undefined,
        vintages_matter: false,
        release_pattern:
          (survivor.release_pattern as CollapseMapEntry["release_pattern"]) ?? undefined,
      });
    }

    const releasePattern =
      inferReleasePattern(labels) ??
      (survivor.release_pattern as CollapseGroup["releasePattern"]) ??
      null;

    if (releasePattern) {
      for (const e of entries) {
        if (e.expression_name === name) e.release_pattern = releasePattern;
      }
    }

    const previewLabels = [...labels].sort((a, b) => {
      const ay = /^\d{4}$/.test(a) ? Number(a) : null;
      const by = /^\d{4}$/.test(b) ? Number(b) : null;
      if (ay != null && by != null) return by - ay;
      return a.localeCompare(b, undefined, { numeric: true });
    });

    groups.push({
      expressionKey: key,
      expressionName: name,
      brand: survivor.brand,
      survivor,
      variants: variantViews.sort((a, b) =>
        (a.releaseLabel ?? a.product.name).localeCompare(
          b.releaseLabel ?? b.product.name,
          undefined,
          { numeric: true },
        ),
      ),
      releasePattern,
      previewLabels,
    });
  }

  groups.sort((a, b) => a.expressionName.localeCompare(b.expressionName));

  const collapseFlagged = products.filter(collapseFlag).length;

  return {
    groups,
    skipped: skipped.sort((a, b) => a.name.localeCompare(b.name)),
    soloFlags: soloFlags.sort((a, b) => a.product.name.localeCompare(b.product.name)),
    entries,
    stats: {
      totalProducts: products.length,
      collapseFlagged,
      mergeVariants: entries.length,
      expressionGroups: groups.length,
    },
  };
}
