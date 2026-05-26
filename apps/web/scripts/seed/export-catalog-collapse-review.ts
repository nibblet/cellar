/**
 * Clean collapse review export from the live catalog (post-rectify).
 *
 *   pnpm export:catalog-collapse-review
 *   pnpm export:catalog-collapse-review ~/path/to/review.xlsx
 *
 * Sheets:
 *   README — how to read and what to do next
 *   Merge groups — one row per expression that would collapse (summary)
 *   Variants — each row that merges into a survivor
 *   Solo flags — collapse=Y but no merge partner (fix in /admin/catalog)
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import {
  buildCollapseAnalysis,
  expressionIdentityKey,
  isCollapseFlagged,
  type CatalogProductRow,
} from "@/lib/catalog/collapse-groups";
import { labelsFromSpecs } from "@/lib/tasting/known-release-labels";
import { adminClient } from "./lib/supabase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = path.resolve(
  __dirname,
  "../../../../data/catalog-collapse-review.xlsx",
);

function specStr(specs: Record<string, unknown> | null, key: string): string {
  const v = specs?.[key];
  if (v === null || v === undefined || v === "") return "";
  return String(v).trim();
}

async function fetchProducts(): Promise<CatalogProductRow[]> {
  const supa = adminClient();
  const all: CatalogProductRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supa
      .from("products")
      .select("id, name, brand, specs, release_pattern")
      .eq("type", "bourbon")
      .eq("status", "confirmed")
      .order("name")
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...(data as CatalogProductRow[]));
  }
  return all;
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8E0D4" },
  };
}

async function main() {
  const outPath = process.argv.find((a) => a.endsWith(".xlsx"))
    ? path.resolve(process.argv.find((a) => a.endsWith(".xlsx"))!)
    : DEFAULT_OUT;

  const products = await fetchProducts();
  const analysis = buildCollapseAnalysis(products);

  const wb = new ExcelJS.Workbook();
  wb.creator = "NCCC";
  wb.created = new Date();

  const readme = wb.addWorksheet("README");
  for (const line of [
    "Catalog Collapse Review — final sign-off (live DB)",
    `Generated: ${new Date().toISOString()}`,
    "",
    `Bourbons in catalog: ${analysis.stats.totalProducts}`,
    `Rows flagged collapse=Y: ${analysis.stats.collapseFlagged}`,
    `Merge groups (2+ flagged siblings): ${analysis.stats.expressionGroups}`,
    `Variant rows to delete after merge: ${analysis.stats.mergeVariants}`,
    `Solo collapse flags (fix before apply): ${analysis.soloFlags.length}`,
    "",
    "How to review:",
    "  1. Merge groups — confirm expression name + preview chips match bar talk.",
    "  2. Variants — each row becomes a release chip on the survivor.",
    "  3. Solo flags — unflag (Collapse N) or add a flagged sibling.",
    "",
    "Interactive preview: /admin/catalog (toggle Collapse Y/N)",
    "",
    "When approved:",
    "  pnpm generate:collapse-map --write",
    "  pnpm collapse:catalog --dry-run",
    "  pnpm collapse:catalog --apply",
    "",
    "Tier is NOT on this sheet — collapse is expression-driven only.",
  ]) {
    readme.addRow([line]);
  }
  readme.getColumn(1).width = 100;

  const groupsWs = wb.addWorksheet("Merge groups", { views: [{ state: "frozen", ySplit: 1 }] });
  const groupHeaders = [
    "expression_name",
    "brand",
    "row_count",
    "variant_count",
    "survivor_name",
    "survivor_id",
    "preview_chips",
    "release_pattern",
    "missing_release_labels",
    "REVIEW_ok",
    "REVIEW_notes",
  ];
  groupsWs.addRow(groupHeaders);
  styleHeader(groupsWs.getRow(1));

  for (const g of analysis.groups) {
    const missing = g.variants.filter((v) => !v.releaseLabel).length;
    groupsWs.addRow([
      g.expressionName,
      g.brand ?? "",
      g.variants.length + 1,
      g.variants.length,
      g.survivor.name,
      g.survivor.id,
      g.previewLabels.join(", "),
      g.releasePattern ?? "",
      missing,
      "",
      "",
    ]);
  }
  groupsWs.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: analysis.groups.length + 1, column: groupHeaders.length },
  };
  for (let c = 1; c <= groupHeaders.length; c++) {
    groupsWs.getColumn(c).width = c === 7 ? 36 : 18;
  }

  const variantsWs = wb.addWorksheet("Variants", { views: [{ state: "frozen", ySplit: 1 }] });
  const variantHeaders = [
    "expression_name",
    "brand",
    "role",
    "variant_name",
    "product_id",
    "release_label",
    "curated_expression",
    "expression_type",
    "known_release_labels",
    "collapse_flag",
    "survivor_id",
    "REVIEW_ok",
    "REVIEW_notes",
  ];
  variantsWs.addRow(variantHeaders);
  styleHeader(variantsWs.getRow(1));

  let variantRows = 0;
  for (const g of analysis.groups) {
    const survivorLabels = labelsFromSpecs(g.survivor.specs).join(", ");
    variantsWs.addRow([
      g.expressionName,
      g.brand ?? "",
      "KEEPS",
      g.survivor.name,
      g.survivor.id,
      specStr(g.survivor.specs, "curation_release_label"),
      specStr(g.survivor.specs, "curated_expression"),
      specStr(g.survivor.specs, "expression_type"),
      survivorLabels,
      "Y",
      g.survivor.id,
      "",
      "",
    ]);
    variantRows += 1;

    for (const { product, releaseLabel } of g.variants) {
      variantsWs.addRow([
        g.expressionName,
        g.brand ?? "",
        "MERGES",
        product.name,
        product.id,
        releaseLabel ?? "",
        specStr(product.specs, "curated_expression"),
        specStr(product.specs, "expression_type"),
        labelsFromSpecs(product.specs).join(", "),
        "Y",
        g.survivor.id,
        "",
        "",
      ]);
      variantRows += 1;
    }
  }
  variantsWs.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: variantRows + 1, column: variantHeaders.length },
  };
  for (let c = 1; c <= variantHeaders.length; c++) {
    variantsWs.getColumn(c).width = c === 4 ? 42 : 16;
  }

  const soloWs = wb.addWorksheet("Solo flags", { views: [{ state: "frozen", ySplit: 1 }] });
  const soloHeaders = [
    "name",
    "brand",
    "product_id",
    "expression_identity",
    "curated_expression",
    "expression_type",
    "reason",
    "REVIEW_action",
    "REVIEW_notes",
  ];
  soloWs.addRow(soloHeaders);
  styleHeader(soloWs.getRow(1));

  for (const { product, reason } of analysis.soloFlags) {
    soloWs.addRow([
      product.name,
      product.brand ?? "",
      product.id,
      expressionIdentityKey(product),
      specStr(product.specs, "curated_expression"),
      specStr(product.specs, "expression_type"),
      reason,
      "",
      "",
    ]);
  }
  soloWs.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: analysis.soloFlags.length + 1, column: soloHeaders.length },
  };

  const flaggedWs = wb.addWorksheet("All collapse flagged", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const flaggedHeaders = [
    "name",
    "brand",
    "product_id",
    "expression_identity",
    "in_merge_group",
    "curated_expression",
    "expression_type",
    "tier",
  ];
  flaggedWs.addRow(flaggedHeaders);
  styleHeader(flaggedWs.getRow(1));

  const groupProductIds = new Set<string>();
  for (const g of analysis.groups) {
    groupProductIds.add(g.survivor.id);
    for (const v of g.variants) groupProductIds.add(v.product.id);
  }

  for (const p of products.filter((row) => isCollapseFlagged(row))) {
    flaggedWs.addRow([
      p.name,
      p.brand ?? "",
      p.id,
      expressionIdentityKey(p),
      groupProductIds.has(p.id) ? "Y" : "N",
      specStr(p.specs, "curated_expression"),
      specStr(p.specs, "expression_type"),
      specStr(p.specs, "tier"),
    ]);
  }

  await wb.xlsx.writeFile(outPath);

  console.log(`[export:catalog-collapse-review] wrote → ${outPath}`);
  console.log(
    `[export:catalog-collapse-review] groups=${analysis.groups.length} variants=${analysis.stats.mergeVariants} solo=${analysis.soloFlags.length} flagged=${analysis.stats.collapseFlagged}`,
  );
}

main().catch((err) => {
  console.error("[export:catalog-collapse-review] failed:", err);
  process.exit(1);
});
