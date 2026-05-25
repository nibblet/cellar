/**
 * Export the cigar catalog to xlsx for offline curation review.
 *
 *   pnpm seed:export-cigar-catalog
 *   pnpm seed:export-cigar-catalog ~/Downloads/cigar-review.xlsx
 *
 * Output defaults to scripts/seed/data/private/cigar-catalog-review-{date}.xlsx
 * (gitignored). Fill REVIEW_* columns and bring the file back for import/analysis.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { buildTagCloud } from "@/lib/aggregation/group-voice";
import { formatPriceBucket, normalizeProductSpecs } from "@/lib/catalog/normalize-specs";
import type { WheelVector } from "@/lib/wheel";
import { adminClient } from "./lib/supabase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = path.join(
  __dirname,
  "data",
  "private",
  `cigar-catalog-review-${new Date().toISOString().slice(0, 10)}.xlsx`,
);

const SEED_REVIEW_SOURCES = new Set([
  "halfwheel",
  "stickpicks",
  "cigar-api",
  "cigarbase",
  "bourbonExplorer",
  "seed",
]);

const REVIEW_EXCERPT_MAX = 400;

type ProductRow = {
  id: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  status: string;
  specs: Record<string, unknown> | null;
  wheel_vector: WheelVector | null;
};

type ReviewDetail = {
  sources: string[];
  hasApify: boolean;
  stickpicksDescription: string;
  seedFlavorText: string;
  reviewExcerpt: string;
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

function dimensionsDisplay(specs: Record<string, unknown> | null): string {
  if (!specs) return "";
  const len = specNum(specs, "length_inches");
  const rg = specNum(specs, "ring_gauge");
  if (len != null && rg != null) return `${len}" × ${rg}`;
  if (len != null) return `${len}"`;
  if (rg != null) return `RG ${rg}`;
  return "";
}

function topFlavorTags(wheelVector: WheelVector | null): string {
  if (!wheelVector || Object.keys(wheelVector).length === 0) return "";
  return buildTagCloud("cigar", [wheelVector], 8)
    .map((e) => e.label)
    .join(", ");
}

function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

async function fetchProducts(): Promise<ProductRow[]> {
  const supa = adminClient();
  const pageSize = 1000;
  let from = 0;
  const all: ProductRow[] = [];

  while (true) {
    const { data, error } = await supa
      .from("products")
      .select("id, name, brand, image_url, status, specs, wheel_vector")
      .eq("type", "cigar")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...(data as ProductRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function fetchReviewDetails(): Promise<Map<string, ReviewDetail>> {
  const supa = adminClient();
  const pageSize = 1000;
  let from = 0;
  const byProduct = new Map<string, ReviewDetail>();

  while (true) {
    const { data, error } = await supa
      .from("product_reviews")
      .select("product_id, source, text")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;

    for (const row of data) {
      const text = typeof row.text === "string" ? row.text.trim() : "";
      const cur = byProduct.get(row.product_id) ?? {
        sources: [],
        hasApify: false,
        stickpicksDescription: "",
        seedFlavorText: "",
        reviewExcerpt: "",
      };

      if (!cur.sources.includes(row.source)) cur.sources.push(row.source);

      if (!SEED_REVIEW_SOURCES.has(row.source)) {
        cur.hasApify = true;
        if (text.length > cur.reviewExcerpt.length) cur.reviewExcerpt = text;
      } else if (row.source === "stickpicks" && text.length > cur.stickpicksDescription.length) {
        cur.stickpicksDescription = text;
      } else if (
        (row.source === "halfwheel" || row.source === "cigar-api" || row.source === "cigarbase") &&
        text.length > cur.seedFlavorText.length
      ) {
        cur.seedFlavorText = text;
      }

      byProduct.set(row.product_id, cur);
    }

    if (data.length < pageSize) break;
    from += pageSize;
  }

  for (const detail of byProduct.values()) {
    detail.reviewExcerpt = truncate(detail.reviewExcerpt, REVIEW_EXCERPT_MAX);
    detail.stickpicksDescription = truncate(detail.stickpicksDescription, REVIEW_EXCERPT_MAX);
    detail.seedFlavorText = truncate(detail.seedFlavorText, REVIEW_EXCERPT_MAX);
  }

  return byProduct;
}

function defaultOutPath(): string {
  return process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_OUT;
}

function writeInstructionsSheet(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("README", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const lines = [
    "NCCC Cigar Catalog — Curation Review",
    "",
    "Purpose: curate the catalog, flag club staples, and mark obscure entries.",
    "",
    "Flavor data in this export:",
    "  top_flavor_tags — catalog baseline from wheel_vector (StickPicks flavors → wheel)",
    "  stickpicks_description — seed prose from StickPicks JSON (when present)",
    "  seed_review_text — halfwheel / cigar-api / cigarbase review (when present)",
    "  review_excerpt — longest Apify web review (when enriched)",
    "",
    "Column guide:",
    "  product_id — stable UUID; keep unchanged for re-import",
    "  price_tier — StickPicks 1–5 ($ … $$$$ display bucket in app)",
    "  has_wheel_vector / has_image / has_apify_reviews — data completeness",
    "",
    "Fill these columns and bring the file back:",
    "  REVIEW_staple — Y if this is a club staple worth prioritizing",
    "  REVIEW_keep — Y to keep, N to hide/archive candidate",
    "  REVIEW_notes — free text (duplicate, wrong vitola, boutique-only, etc.)",
    "",
    `Exported: ${new Date().toISOString()}`,
    "Cigars have no allocation tier — use REVIEW_staple for enrichment priority.",
  ];
  for (const line of lines) {
    ws.addRow([line]);
  }
  ws.getColumn(1).width = 100;
}

async function main() {
  const outPath = defaultOutPath();
  const [products, reviews] = await Promise.all([fetchProducts(), fetchReviewDetails()]);

  products.sort((a, b) => {
    const brandCmp = (a.brand ?? "").localeCompare(b.brand ?? "");
    if (brandCmp !== 0) return brandCmp;
    return a.name.localeCompare(b.name);
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "NCCC";
  wb.created = new Date();

  writeInstructionsSheet(wb);

  const ws = wb.addWorksheet("Cigars", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const headers = [
    "product_id",
    "brand",
    "name",
    "vitola",
    "wrapper",
    "binder",
    "filler",
    "country",
    "factory",
    "strength",
    "body",
    "dimensions",
    "length_inches",
    "ring_gauge",
    "price_tier",
    "price_bucket",
    "msrp_usd",
    "score",
    "top_flavor_tags",
    "stickpicks_description",
    "seed_review_text",
    "review_excerpt",
    "has_wheel_vector",
    "has_image",
    "has_apify_reviews",
    "review_sources",
    "status",
    "REVIEW_staple",
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
    const rev = reviews.get(p.id);
    const normalized = normalizeProductSpecs("cigar", specs);
    const priceBucket =
      normalized.priceBucket != null ? formatPriceBucket(normalized.priceBucket) : "";
    const hasWheel =
      p.wheel_vector != null && Object.keys(p.wheel_vector).some((k) => (p.wheel_vector?.[k] ?? 0) > 0);

    ws.addRow([
      p.id,
      p.brand ?? "",
      p.name,
      specStr(specs, "vitola"),
      specStr(specs, "wrapper"),
      specStr(specs, "binder"),
      specStr(specs, "filler"),
      specStr(specs, "country"),
      specStr(specs, "factory"),
      specStr(specs, "strength"),
      specStr(specs, "body"),
      dimensionsDisplay(specs),
      specNum(specs, "length_inches"),
      specNum(specs, "ring_gauge"),
      specNum(specs, "price_tier"),
      priceBucket,
      specNum(specs, "msrp_usd"),
      specNum(specs, "score"),
      topFlavorTags(p.wheel_vector),
      rev?.stickpicksDescription ?? "",
      rev?.seedFlavorText ?? "",
      rev?.reviewExcerpt ?? "",
      hasWheel ? "Y" : "",
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
    vitola: 16,
    wrapper: 18,
    binder: 16,
    filler: 24,
    country: 14,
    factory: 18,
    strength: 14,
    body: 14,
    dimensions: 12,
    length_inches: 10,
    ring_gauge: 10,
    price_tier: 10,
    price_bucket: 10,
    msrp_usd: 10,
    score: 8,
    top_flavor_tags: 36,
    stickpicks_description: 44,
    seed_review_text: 44,
    review_excerpt: 44,
    has_wheel_vector: 10,
    has_image: 10,
    has_apify_reviews: 10,
    review_sources: 32,
    status: 10,
    REVIEW_staple: 12,
    REVIEW_keep: 10,
    REVIEW_notes: 40,
  };
  for (const [i, h] of headers.entries()) {
    ws.getColumn(i + 1).width = widths[h] ?? 14;
  }

  for (let c = headers.indexOf("REVIEW_staple") + 1; c <= headers.length; c++) {
    ws.getColumn(c).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFF3D6" },
    };
  }

  await wb.xlsx.writeFile(outPath);

  const withImage = products.filter((p) => p.image_url).length;
  const withApify = products.filter((p) => reviews.get(p.id)?.hasApify).length;
  const withWheel = products.filter(
    (p) =>
      p.wheel_vector != null &&
      Object.keys(p.wheel_vector).some((k) => (p.wheel_vector?.[k] ?? 0) > 0),
  ).length;

  console.log(`[export-cigar-catalog] wrote ${products.length} rows → ${outPath}`);
  console.log(`[export-cigar-catalog] wheel_vector: ${withWheel}`);
  console.log(`[export-cigar-catalog] has_image: ${withImage}`);
  console.log(`[export-cigar-catalog] has_apify_reviews: ${withApify}`);
}

main().catch((err) => {
  console.error("[export-cigar-catalog] failed:", err);
  process.exit(1);
});
