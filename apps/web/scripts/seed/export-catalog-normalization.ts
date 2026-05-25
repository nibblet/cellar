/**
 * Export bourbon catalog normalization proposals for Paul's review.
 *
 *   pnpm export:catalog-normalization
 *   pnpm export:catalog-normalization ~/Downloads/normalization-review.xlsx
 *
 * Fill REVIEW_* columns and use approved rows to build catalog-collapse-map.json.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import {
  buildNormalizationContext,
  finalizeCollapseProposals,
  proposeNormalization,
  type NormalizationInput,
} from "@/lib/catalog/expression-normalize";
import { adminClient } from "./lib/supabase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = path.resolve(
  __dirname,
  "../../../../data/catalog-normalization-review.xlsx",
);

const SEED_SOURCES = new Set([
  "halfwheel",
  "stickpicks",
  "cigar-api",
  "cigarbase",
  "bourbonExplorer",
  "seed",
]);

type ProductRow = NormalizationInput & {
  image_url: string | null;
  specs: Record<string, unknown> | null;
};

async function fetchProducts(): Promise<ProductRow[]> {
  const supa = adminClient();
  const all: ProductRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supa
      .from("products")
      .select("id, name, brand, image_url, specs")
      .eq("type", "bourbon")
      .eq("status", "confirmed")
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...(data as ProductRow[]));
  }
  return all;
}

async function fetchApifyIds(): Promise<Set<string>> {
  const supa = adminClient();
  const ids = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supa
      .from("product_reviews")
      .select("product_id, source")
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      if (!SEED_SOURCES.has(row.source)) ids.add(row.product_id);
    }
  }
  return ids;
}

function specStr(specs: Record<string, unknown> | null, key: string): string {
  const v = specs?.[key];
  if (v === null || v === undefined || v === "") return "";
  return String(v);
}

async function main() {
  const outPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_OUT;
  const [products, apifyIds] = await Promise.all([fetchProducts(), fetchApifyIds()]);

  const nameIndex = new Map(products.map((p) => [p.name, p.id]));

  const normContext = buildNormalizationContext(products);

  let rows = products.map((p) => ({
    ...p,
    proposal: proposeNormalization(p, normContext),
  }));
  rows = finalizeCollapseProposals(rows);

  rows.sort((a, b) => {
    const c = a.proposal.canonical_name.localeCompare(b.proposal.canonical_name);
    if (c !== 0) return c;
    if (a.proposal.is_survivor !== b.proposal.is_survivor) {
      return a.proposal.is_survivor ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  const groupSizes = new Map<string, number>();
  for (const r of rows) {
    groupSizes.set(r.proposal.canonical_name, (groupSizes.get(r.proposal.canonical_name) ?? 0) + 1);
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "NCCC";
  wb.created = new Date();

  const readme = wb.addWorksheet("README");
  const instructions = [
    "Catalog Normalization Review — Phase 2",
    "",
    "Purpose: approve canonical brand + expression + release labels before collapse.",
    "",
    "Columns:",
    "  proposed_* — script suggestion (read-only reference)",
    "  proposed_brand — line brand after promotion (may differ from catalog brand)",
    "  proposed_expression — parsed expression within the line brand",
    "  REVIEW_collapse — Y to merge this row into REVIEW_canonical_name",
    "  REVIEW_canonical_name — survivor expression name",
    "  REVIEW_release_label — variant label on tastings after merge (e.g. 2021, #6)",
    "  REVIEW_vintages_matter — Y when product page should group by year",
    "  REVIEW_release_pattern — year | batch | pick | blank",
    "  REVIEW_keep — N to hide/archive instead of collapsing",
    "  REVIEW_notes — free text",
    "",
    "Rules baked into proposals:",
    "  Line brand promotion (Buffalo Trace distillery bucket → Experimental Collection, WLW, etc.)",
    "  Identity vs series expressions; Barrell, Angel's Envy, Baker's, 1792",
    "  Never collapse: Birthday Bourbon, George T. Stagg, Orphan Barrel, Old Fitzgerald",
    "",
    `Exported: ${new Date().toISOString()} · ${rows.length} bourbons`,
  ];
  for (const line of instructions) readme.addRow([line]);
  readme.getColumn(1).width = 100;

  const ws = wb.addWorksheet("Normalize", { views: [{ state: "frozen", ySplit: 1 }] });

  const headers = [
    "product_id",
    "brand",
    "name",
    "tier",
    "expression_type",
    "year_made",
    "age_label",
    "has_image",
    "has_apify",
    "group_size",
    "survivor_exists",
    "is_survivor_row",
    "proposed_canonical_name",
    "proposed_brand",
    "proposed_expression",
    "proposed_spirit_type",
    "proposed_release_label",
    "proposed_release_pattern",
    "proposed_vintages_matter",
    "proposed_collapse",
    "skip_reason",
    "REVIEW_collapse",
    "REVIEW_canonical_name",
    "REVIEW_release_label",
    "REVIEW_vintages_matter",
    "REVIEW_release_pattern",
    "REVIEW_keep",
    "REVIEW_notes",
  ];

  ws.addRow(headers);
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8E0D4" },
  };

  let collapseCount = 0;
  for (const r of rows) {
    const p = r.proposal;
    if (p.collapse) collapseCount += 1;
    const survivorExists = nameIndex.has(p.canonical_name) ? "Y" : "N";

    ws.addRow([
      r.id,
      r.brand ?? "",
      r.name,
      r.specs?.tier ?? "",
      specStr(r.specs, "expression_type"),
      r.specs?.year_made ?? "",
      specStr(r.specs, "age_label"),
      r.image_url ? "Y" : "N",
      apifyIds.has(r.id) ? "Y" : "N",
      groupSizes.get(p.canonical_name) ?? 1,
      survivorExists,
      p.is_survivor ? "Y" : "N",
      p.canonical_name,
      p.canonical_brand ?? r.brand ?? "",
      p.expression_label ?? "",
      p.spirit_type ?? "",
      p.release_label ?? "",
      p.release_pattern ?? "",
      p.vintages_matter ? "Y" : "N",
      p.collapse ? "Y" : "N",
      p.skip_reason ?? "",
      p.collapse ? "Y" : "N",
      p.canonical_name,
      p.release_label ?? "",
      p.vintages_matter ? "Y" : "N",
      p.release_pattern ?? "",
      "Y",
      "",
    ]);
  }

  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: rows.length + 1, column: headers.length },
  };

  const reviewStart = headers.indexOf("REVIEW_collapse") + 1;
  for (let c = reviewStart; c <= headers.length; c++) {
    ws.getColumn(c).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFF3D6" },
    };
  }

  const widths: Record<string, number> = {
    product_id: 38,
    brand: 22,
    name: 48,
    proposed_canonical_name: 40,
    proposed_brand: 22,
    proposed_expression: 36,
    proposed_spirit_type: 12,
    REVIEW_canonical_name: 40,
    skip_reason: 28,
    REVIEW_notes: 36,
  };
  for (const [i, h] of headers.entries()) {
    ws.getColumn(i + 1).width = widths[h] ?? 14;
  }

  // Collapse candidates summary sheet
  const summary = wb.addWorksheet("Collapse groups");
  summary.addRow(["canonical_name", "variant_count", "survivor_exists", "sample_variants"]);
  summary.getRow(1).font = { bold: true };
  const groups = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.proposal.collapse) continue;
    const list = groups.get(r.proposal.canonical_name) ?? [];
    list.push(r.name);
    groups.set(r.proposal.canonical_name, list);
  }
  for (const [canonical, variants] of [...groups.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    summary.addRow([
      canonical,
      variants.length,
      nameIndex.has(canonical) ? "Y" : "N",
      variants.slice(0, 5).join(" | "),
    ]);
  }

  await wb.xlsx.writeFile(outPath);

  console.log(`[export-catalog-normalization] wrote ${rows.length} rows → ${outPath}`);
  console.log(`[export-catalog-normalization] proposed collapse variants: ${collapseCount}`);
  console.log(`[export-catalog-normalization] collapse groups: ${groups.size}`);
}

main().catch((err) => {
  console.error("[export-catalog-normalization] failed:", err);
  process.exit(1);
});
