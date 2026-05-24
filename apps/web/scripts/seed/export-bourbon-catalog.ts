/**
 * Export the bourbon catalog to xlsx for offline tier curation review.
 *
 *   pnpm seed:export-bourbon-catalog
 *   pnpm seed:export-bourbon-catalog ~/Downloads/bourbon-review.xlsx
 *
 * Output defaults to scripts/seed/data/private/bourbon-catalog-review-{date}.xlsx
 * (gitignored). Fill REVIEW_* columns and bring the file back for import/analysis.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import {
  productVisibleWithMaxCatalogTier,
  tierToRarityLabel,
} from "@/lib/catalog/normalize-specs";
import { DEFAULT_MAX_CATALOG_TIER } from "@/lib/preferences/types";
import { tierSortKey } from "./lib/enrich-order";
import { adminClient } from "./lib/supabase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = path.join(
  __dirname,
  "data",
  "private",
  `bourbon-catalog-review-${new Date().toISOString().slice(0, 10)}.xlsx`,
);

const SEED_REVIEW_SOURCES = new Set([
  "halfwheel",
  "stickpicks",
  "cigar-api",
  "cigarbase",
  "bourbonExplorer",
  "seed",
]);

type ProductRow = {
  id: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  status: string;
  specs: Record<string, unknown> | null;
};

type ReviewAgg = {
  sources: string[];
  hasApify: boolean;
};

function specStr(specs: Record<string, unknown> | null, key: string): string {
  if (!specs) return "";
  const v = specs[key];
  if (v === null || v === undefined || v === "") return "";
  return String(v);
}

function specNum(specs: Record<string, unknown> | null, key: string): number | null {
  if (!specs) return null;
  const v = specs[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function ageDisplay(specs: Record<string, unknown> | null): string {
  if (!specs) return "";
  const years = specNum(specs, "age_years");
  const label = specStr(specs, "age_label");
  const period = specStr(specs, "aging_period_years");
  if (label) return label;
  if (years != null) return `${years} yr`;
  if (period) return period;
  return "";
}

async function fetchProducts(): Promise<ProductRow[]> {
  const supa = adminClient();
  const pageSize = 1000;
  let from = 0;
  const all: ProductRow[] = [];

  while (true) {
    const { data, error } = await supa
      .from("products")
      .select("id, name, brand, image_url, status, specs")
      .eq("type", "bourbon")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...(data as ProductRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function fetchReviewAggs(): Promise<Map<string, ReviewAgg>> {
  const supa = adminClient();
  const pageSize = 1000;
  let from = 0;
  const byProduct = new Map<string, ReviewAgg>();

  while (true) {
    const { data, error } = await supa
      .from("product_reviews")
      .select("product_id, source")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;

    for (const row of data) {
      const cur = byProduct.get(row.product_id) ?? { sources: [], hasApify: false };
      if (!cur.sources.includes(row.source)) cur.sources.push(row.source);
      if (!SEED_REVIEW_SOURCES.has(row.source)) cur.hasApify = true;
      byProduct.set(row.product_id, cur);
    }

    if (data.length < pageSize) break;
    from += pageSize;
  }
  return byProduct;
}

function defaultOutPath(): string {
  return process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_OUT;
}

async function writeInstructionsSheet(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("README", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const lines = [
    "NCCC Bourbon Catalog — Tier Curation Review",
    "",
    "Purpose: curate the catalog and improve tier rules before batch enrichment.",
    "",
    "Tier semantics (Cobb scale, 1 = most available):",
    "  1–2  Common — widely available shelf bourbon",
    "  3    Uncommon — seasonal, regional, or limited but findable",
    "  4–5  Rare — allocated, lottery, secondary-market, discontinued gems",
    "",
    "Column guide:",
    "  product_id — stable UUID; keep unchanged for re-import",
    "  tier / tier_source / tier_rationale — current LLM or Cobb classification",
    "  visible_at_default — shown when member max_catalog_tier = 2 (app default)",
    "  in_cobb_collection — Paul's shelf (ground truth when tier_source = cobb)",
    "  has_image / has_apify_reviews — enrichment status",
    "",
    "Fill these columns and bring the file back:",
    "  REVIEW_tier — your corrected tier (1–5), blank = no change",
    "  REVIEW_keep — Y to keep in catalog, N to hide/archive candidate",
    "  REVIEW_notes — free text (staple, obscure, duplicate, wrong distillery, etc.)",
    "",
    `Exported: ${new Date().toISOString()}`,
    `Default catalog filter hides tier > ${DEFAULT_MAX_CATALOG_TIER} (unknown tier still shown).`,
  ];
  for (const line of lines) {
    ws.addRow([line]);
  }
  ws.getColumn(1).width = 100;
}

async function main() {
  const outPath = defaultOutPath();
  const [products, reviews] = await Promise.all([fetchProducts(), fetchReviewAggs()]);

  products.sort((a, b) => {
    const byTier = tierSortKey(a.specs) - tierSortKey(b.specs);
    if (byTier !== 0) return byTier;
    const brandCmp = (a.brand ?? "").localeCompare(b.brand ?? "");
    if (brandCmp !== 0) return brandCmp;
    return a.name.localeCompare(b.name);
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "NCCC";
  wb.created = new Date();

  await writeInstructionsSheet(wb);

  const ws = wb.addWorksheet("Bourbons", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const headers = [
    "product_id",
    "brand",
    "name",
    "distillery",
    "whiskey_type",
    "expression_type",
    "mash_bill",
    "proof",
    "abv",
    "age",
    "price_usd",
    "year_made",
    "tier",
    "tier_source",
    "rarity",
    "tier_rationale",
    "in_cobb_collection",
    "visible_at_default",
    "has_image",
    "has_apify_reviews",
    "review_sources",
    "status",
    "REVIEW_tier",
    "REVIEW_keep",
    "REVIEW_notes",
  ];

  ws.addRow(headers);
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8E0D4" },
  };

  for (const p of products) {
    const specs = p.specs;
    const tier = specNum(specs, "tier");
    const rarity = tier != null ? (tierToRarityLabel(tier) ?? "") : "";
    const rev = reviews.get(p.id);

    ws.addRow([
      p.id,
      p.brand ?? "",
      p.name,
      specStr(specs, "distillery"),
      specStr(specs, "whiskey_type"),
      specStr(specs, "expression_type"),
      specStr(specs, "mash_bill"),
      specNum(specs, "proof"),
      specNum(specs, "abv"),
      ageDisplay(specs),
      specNum(specs, "price_usd") ?? specNum(specs, "msrp_usd"),
      specNum(specs, "year_made"),
      tier,
      specStr(specs, "tier_source"),
      rarity,
      specStr(specs, "tier_rationale"),
      specs?.in_cobb_collection === true ? "Y" : "",
      productVisibleWithMaxCatalogTier(specs, DEFAULT_MAX_CATALOG_TIER) ? "Y" : "N",
      p.image_url ? "Y" : "",
      rev?.hasApify ? "Y" : "",
      rev?.sources.sort().join(", ") ?? "",
      p.status,
      "",
      "",
      "",
    ]);
  }

  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: products.length + 1, column: headers.length },
  };

  const widths: Record<string, number> = {
    product_id: 38,
    brand: 22,
    name: 42,
    distillery: 28,
    whiskey_type: 14,
    expression_type: 22,
    mash_bill: 30,
    proof: 8,
    abv: 8,
    age: 14,
    price_usd: 10,
    year_made: 10,
    tier: 6,
    tier_source: 12,
    rarity: 12,
    tier_rationale: 48,
    in_cobb_collection: 8,
    visible_at_default: 10,
    has_image: 10,
    has_apify_reviews: 10,
    review_sources: 36,
    status: 10,
    REVIEW_tier: 10,
    REVIEW_keep: 10,
    REVIEW_notes: 40,
  };
  for (const [i, h] of headers.entries()) {
    ws.getColumn(i + 1).width = widths[h] ?? 14;
  }

  // Highlight review columns for Paul
  for (let c = headers.indexOf("REVIEW_tier") + 1; c <= headers.length; c++) {
    ws.getColumn(c).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFF3D6" },
    };
  }

  await wb.xlsx.writeFile(outPath);

  const tierCounts = new Map<number | "none", number>();
  for (const p of products) {
    const t = specNum(p.specs, "tier");
    const key = t ?? "none";
    tierCounts.set(key, (tierCounts.get(key) ?? 0) + 1);
  }

  console.log(`[export-bourbon-catalog] wrote ${products.length} rows → ${outPath}`);
  console.log("[export-bourbon-catalog] tier breakdown:");
  for (const t of [1, 2, 3, 4, 5, "none"] as const) {
    const n = tierCounts.get(t);
    if (n) console.log(`  tier ${t}: ${n}`);
  }
}

main().catch((err) => {
  console.error("[export-bourbon-catalog] failed:", err);
  process.exit(1);
});
