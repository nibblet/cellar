/**
 * Export bourbon catalog for hand curation — brand, expression, canonical name,
 * age, release year, tier, distillery.
 *
 *   pnpm export:catalog-from-db                   # new dated file — never overwrites
 *   pnpm export:catalog-curation ~/Downloads/curation.xlsx --overwrite
 *   pnpm export:catalog-curation --fresh          # ignore existing REVIEW_* edits
 *   pnpm export:catalog-curation --merge-from ~/Downloads/my-edits.xlsx
 *   pnpm export:catalog-curation --tier=3
 *   pnpm export:catalog-curation --tier=3 --merge-from data/catalog-curation-review.xlsx
 *
 * Re-exporting **copies yellow REVIEW_* verbatim** from the merge source (by
 * product_id). Reference + proposed_* columns always refresh from the DB/script.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { copyFileSync, existsSync } from "node:fs";
import ExcelJS from "exceljs";
import {
  buildNormalizationContext,
  finalizeCollapseProposals,
  proposeNormalization,
  type NormalizationInput,
} from "@/lib/catalog/expression-normalize";
import { cleanCatalogDisplayName } from "@/lib/catalog/catalog-name-cleanup";
import { tierToRarityLabel } from "@/lib/catalog/normalize-specs";
import { tierSortKey } from "./lib/enrich-order";
import { adminClient } from "./lib/supabase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../../../data");
const LEGACY_MASTER = path.resolve(DATA_DIR, "catalog-curation-review.xlsx");

function nextExportPath(): string {
  const day = new Date().toISOString().slice(0, 10);
  let n = 0;
  for (;;) {
    const suffix = n === 0 ? "" : `-${n}`;
    const candidate = path.join(DATA_DIR, `catalog-curation-export-${day}${suffix}.xlsx`);
    if (!existsSync(candidate)) return candidate;
    n += 1;
  }
}

function defaultTierOutPath(tier: number): string {
  return path.resolve(
    __dirname,
    `../../../../data/catalog-curation-tier${tier}-review.xlsx`,
  );
}

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
  status: string;
  vintages_matter: boolean;
  release_pattern: string | null;
};

function specStr(specs: Record<string, unknown> | null, key: string): string {
  const v = specs?.[key];
  if (v === null || v === undefined || v === "") return "";
  return String(v);
}

function specNum(specs: Record<string, unknown> | null, key: string): number | "" {
  const v = specs?.[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return "";
}

function ageDisplay(specs: Record<string, unknown> | null): string {
  const label = specStr(specs, "age_label");
  if (label) return label;
  const years = specNum(specs, "age_years");
  if (years !== "") return `${years} yr`;
  return specStr(specs, "aging_period_years");
}

async function fetchProducts(): Promise<ProductRow[]> {
  const supa = adminClient();
  const all: ProductRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supa
      .from("products")
      .select("id, name, brand, image_url, status, specs, vintages_matter, release_pattern")
      .eq("type", "bourbon")
      .eq("status", "confirmed")
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...(data as ProductRow[]));
  }
  return all;
}

const REVIEW_COLUMNS = [
  "REVIEW_brand",
  "REVIEW_expression",
  "REVIEW_canonical_name",
  "REVIEW_age",
  "REVIEW_year_made",
  "REVIEW_release_label",
  "REVIEW_tier",
  "REVIEW_distillery",
  "REVIEW_whiskey_type",
  "REVIEW_spirit_type",
  "REVIEW_expression_type",
  "REVIEW_rarity",
  "REVIEW_vintages_matter",
  "REVIEW_release_pattern",
  "REVIEW_collapse",
  "REVIEW_keep",
  "REVIEW_notes",
] as const;

type SavedReview = Partial<Record<(typeof REVIEW_COLUMNS)[number], string>>;

function cellValue(raw: ExcelJS.CellValue): unknown {
  if (raw && typeof raw === "object" && "result" in raw) {
    return (raw as { result: unknown }).result;
  }
  return raw;
}

function cellStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function buildHeaderMap(ws: ExcelJS.Worksheet): Map<string, number> {
  const map = new Map<string, number>();
  ws.getRow(1).eachCell((cell, col) => {
    map.set(String(cell.value ?? ""), col);
  });
  return map;
}

/** Load prior REVIEW_* edits keyed by product_id.
 *  `full` — keep every non-empty REVIEW_* cell (use with --merge-from backups).
 *  `edited-only` — keep cells that differ from proposed_* in the source file. */
async function loadSavedReviews(
  xlsxPath: string,
  mode: "full" | "edited-only" = "edited-only",
): Promise<Map<string, SavedReview>> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const ws = wb.getWorksheet("Curate");
  if (!ws) return new Map();

  const hmap = buildHeaderMap(ws);
  const idCol = hmap.get("product_id");
  if (!idCol) return new Map();

  const proposedPairs: [keyof SavedReview, string][] = [
    ["REVIEW_brand", "proposed_brand"],
    ["REVIEW_expression", "proposed_expression"],
    ["REVIEW_canonical_name", "proposed_canonical_name"],
    ["REVIEW_spirit_type", "proposed_spirit_type"],
    ["REVIEW_release_label", "proposed_release_label"],
    ["REVIEW_vintages_matter", "proposed_vintages_matter"],
    ["REVIEW_release_pattern", "proposed_release_pattern"],
    ["REVIEW_collapse", "proposed_collapse"],
  ];

  const saved = new Map<string, SavedReview>();
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const id = cellStr(cellValue(row.getCell(idCol).value));
    if (!/^[0-9a-f-]{36}$/i.test(id)) continue;

    const review: SavedReview = {};
    let hasAny = false;

    if (mode === "full") {
      for (const key of REVIEW_COLUMNS) {
        const col = hmap.get(key);
        if (!col) continue;
        review[key] = cellStr(cellValue(row.getCell(col).value));
      }
      saved.set(id, review);
      continue;
    }

    for (const key of REVIEW_COLUMNS) {
      const col = hmap.get(key);
      if (!col) continue;
      const val = cellStr(cellValue(row.getCell(col).value));
      if (!val) continue;

      if (key === "REVIEW_keep" && val === "N") {
        review[key] = val;
        hasAny = true;
        continue;
      }
      if (key === "REVIEW_notes") {
        review[key] = val;
        hasAny = true;
        continue;
      }

      const pair = proposedPairs.find(([reviewKey]) => reviewKey === key);
      if (pair) {
        const [, proposedKey] = pair;
        const proposedCol = hmap.get(proposedKey);
        const proposed = proposedCol
          ? cellStr(cellValue(row.getCell(proposedCol).value))
          : "";
        if (val !== proposed) {
          review[key] = val;
          hasAny = true;
        }
        continue;
      }

      // Schema-only REVIEW columns (age, tier, distillery, etc.) — preserve if non-empty.
      review[key] = val;
      hasAny = true;
    }

    if (hasAny) saved.set(id, review);
  }
  return saved;
}

function parseTierFilter(argv: string[]): Set<number> | null {
  const arg = argv.find((a) => a.startsWith("--tier="));
  if (!arg) return null;
  const tiers = arg
    .slice("--tier=".length)
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 5);
  if (!tiers.length) throw new Error(`Invalid --tier= value: ${arg}`);
  return new Set(tiers);
}

function parseArgs(argv: string[]) {
  const fresh = argv.includes("--fresh");
  const overwrite = argv.includes("--overwrite");
  const noBackup = argv.includes("--no-backup");
  const tierFilter = parseTierFilter(argv);
  const mergeFromIdx = argv.indexOf("--merge-from");
  const mergeFrom =
    mergeFromIdx >= 0 && argv[mergeFromIdx + 1]
      ? path.resolve(argv[mergeFromIdx + 1])
      : null;
  const mergeAllTiers = argv.includes("--merge-all-tiers");
  const outArg = argv.find(
    (a) => a.endsWith(".xlsx") && a !== mergeFrom && !a.startsWith("--"),
  );
  const explicitOut = Boolean(outArg);
  let resolvedOut = outArg ? path.resolve(outArg) : nextExportPath();
  if (!outArg && tierFilter?.size === 1) {
    resolvedOut = defaultTierOutPath([...tierFilter][0]!);
  }
  return {
    outPath: resolvedOut,
    explicitOut,
    overwrite,
    fresh,
    mergeFrom,
    mergeAllTiers,
    noBackup,
    tierFilter,
  };
}

function curationCollapseFlag(specs: Record<string, unknown> | null): "Y" | "N" {
  const v = specs?.curation_collapse;
  return v === "Y" || v === true ? "Y" : "N";
}

function defaultReviewRow(
  p: ReturnType<typeof proposeNormalization>,
  r: ProductRow,
  cleanup: ReturnType<typeof cleanCatalogDisplayName>,
  specs: Record<string, unknown> | null,
  tier: number | "",
  rarity: string,
): SavedReview {
  return {
    REVIEW_brand: r.brand ?? "",
    REVIEW_expression: specStr(specs, "curated_expression") ?? "",
    REVIEW_canonical_name: r.name,
    REVIEW_age: specStr(specs, "age_label") || ageDisplay(specs) || "",
    REVIEW_year_made: tier !== "" ? String(specNum(specs, "year_made") || "") : "",
    REVIEW_release_label: specStr(specs, "curation_release_label") ?? "",
    REVIEW_tier: tier !== "" ? String(tier) : "",
    REVIEW_distillery: specStr(specs, "distillery"),
    REVIEW_whiskey_type: specStr(specs, "whiskey_type"),
    REVIEW_spirit_type: specStr(specs, "spirit_type") ?? "",
    REVIEW_expression_type: specStr(specs, "expression_type"),
    REVIEW_rarity: specStr(specs, "availability_rarity") || rarity,
    REVIEW_vintages_matter: r.vintages_matter ? "Y" : "N",
    REVIEW_release_pattern: r.release_pattern ?? "",
    REVIEW_collapse: curationCollapseFlag(specs),
    REVIEW_keep: "Y",
    REVIEW_notes: specStr(specs, "curation_notes") ?? "",
  };
}

/** Yellow REVIEW_* from merge source wins verbatim — no script overrides. */
function mergeReview(
  defaults: SavedReview,
  saved: SavedReview | undefined,
  preserve: boolean,
): SavedReview {
  if (!preserve || !saved) return defaults;
  const merged = { ...defaults };
  for (const key of REVIEW_COLUMNS) {
    if (key in saved) merged[key] = saved[key] ?? "";
  }
  return merged;
}

async function fetchReviewMeta(): Promise<
  Map<string, { hasApify: boolean; sources: string[]; count: number }>
> {
  const supa = adminClient();
  const byProduct = new Map<string, { hasApify: boolean; sources: string[]; count: number }>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supa
      .from("product_reviews")
      .select("product_id, source")
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      const cur = byProduct.get(row.product_id) ?? { hasApify: false, sources: [], count: 0 };
      cur.count += 1;
      if (!cur.sources.includes(row.source)) cur.sources.push(row.source);
      if (!SEED_SOURCES.has(row.source)) cur.hasApify = true;
      byProduct.set(row.product_id, cur);
    }
  }
  return byProduct;
}

function tierSlicePaths(): string[] {
  const dataDir = path.resolve(__dirname, "../../../../data");
  const paths: string[] = [];
  for (let t = 1; t <= 5; t++) {
    const p = path.join(dataDir, `catalog-curation-tier${t}-review.xlsx`);
    if (existsSync(p)) paths.push(p);
  }
  return paths;
}

function mergeReviewNonEmpty(
  base: SavedReview | undefined,
  overlay: SavedReview,
): SavedReview {
  const merged: SavedReview = { ...(base ?? {}) };
  for (const key of REVIEW_COLUMNS) {
    const val = overlay[key]?.trim();
    if (val) merged[key] = val;
  }
  return merged;
}

/** Tier slice edits win, but empty cells must not wipe master/audit yellow columns. */
async function loadTierReviewOverrides(): Promise<Map<string, SavedReview>> {
  const merged = new Map<string, SavedReview>();
  for (const p of tierSlicePaths()) {
    const chunk = await loadSavedReviews(p, "full");
    for (const [id, review] of chunk) {
      merged.set(id, mergeReviewNonEmpty(merged.get(id), review));
    }
    console.log(`[export-catalog-curation] tier slice ${path.basename(p)} → ${chunk.size} rows`);
  }
  return merged;
}

async function main() {
  const { outPath, explicitOut, overwrite, fresh, mergeFrom, mergeAllTiers, noBackup, tierFilter } =
    parseArgs(process.argv.slice(2));

  if (explicitOut && existsSync(outPath) && !overwrite) {
    console.error(
      `[export-catalog-curation] Refusing to overwrite ${outPath}\n` +
        "  Use a new path, or pass --overwrite (creates .backup-* first).\n" +
        "  For a safe DB snapshot with no path: pnpm export:catalog-from-db",
    );
    process.exit(1);
  }

  const mergePath =
    mergeFrom ??
    (!fresh && !explicitOut && existsSync(outPath)
      ? outPath
      : !fresh && tierFilter && existsSync(LEGACY_MASTER)
        ? LEGACY_MASTER
        : null);
  const mergeMode: "full" | "edited-only" = "full";

  const savedReviews = mergePath
    ? await loadSavedReviews(mergePath, mergeMode)
    : new Map();

  if (mergeAllTiers) {
    const tierOverrides = await loadTierReviewOverrides();
    for (const [id, review] of tierOverrides) {
      savedReviews.set(id, mergeReviewNonEmpty(savedReviews.get(id), review));
    }
    console.log(
      `[export-catalog-curation] merged tier slices (non-empty cells only) → ${tierOverrides.size} product overrides`,
    );
  }
  if (mergePath && !fresh) {
    console.log(
      `[export-catalog-curation] loaded ${savedReviews.size} rows (${mergeMode} merge) from ${mergePath}`,
    );
    if (savedReviews.size === 0 && mergePath === outPath) {
      console.warn(
        "[export-catalog-curation] WARNING: no manual edits found in existing file — REVIEW_* matches proposed_* everywhere.",
      );
    }
  }

  if (!noBackup && explicitOut && overwrite && existsSync(outPath)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const backupPath = outPath.replace(/\.xlsx$/i, `.backup-${stamp}.xlsx`);
    copyFileSync(outPath, backupPath);
    console.log(`[export-catalog-curation] backup → ${backupPath}`);
  }

  const [products, reviews] = await Promise.all([fetchProducts(), fetchReviewMeta()]);

  const normContext = buildNormalizationContext(products);

  let rows = products.map((p) => ({
    ...p,
    proposal: proposeNormalization(p, normContext),
  }));
  rows = finalizeCollapseProposals(rows);

  const groupSizes = new Map<string, number>();
  for (const r of rows) {
    groupSizes.set(
      r.proposal.canonical_name,
      (groupSizes.get(r.proposal.canonical_name) ?? 0) + 1,
    );
  }

  rows.sort((a, b) => {
    const byTier = tierSortKey(a.specs) - tierSortKey(b.specs);
    if (byTier !== 0) return byTier;
    const distA = specStr(a.specs, "distillery");
    const distB = specStr(b.specs, "distillery");
    const byDist = distA.localeCompare(distB);
    if (byDist !== 0) return byDist;
    const brandA = a.proposal.canonical_brand ?? a.brand ?? "";
    const brandB = b.proposal.canonical_brand ?? b.brand ?? "";
    const byBrand = brandA.localeCompare(brandB);
    if (byBrand !== 0) return byBrand;
    const byCanon = a.proposal.canonical_name.localeCompare(b.proposal.canonical_name);
    if (byCanon !== 0) return byCanon;
    return a.name.localeCompare(b.name);
  });

  const totalBeforeTierFilter = rows.length;
  if (tierFilter) {
    rows = rows.filter((r) => {
      const t = specNum(r.specs, "tier");
      return typeof t === "number" && tierFilter.has(t);
    });
    console.log(
      `[export-catalog-curation] tier filter ${[...tierFilter].sort().join(",")}: ${rows.length} of ${totalBeforeTierFilter} rows`,
    );
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "NCCC";
  wb.created = new Date();

  const readme = wb.addWorksheet("README");
  const instructions = [
    "Catalog curation — export → edit → apply",
    "",
    "1. Export from DB (new file each time, never overwrites):",
    "     pnpm export:catalog-from-db",
    "2. Edit yellow REVIEW_* columns in the exported .xlsx only.",
    "3. Apply back to Supabase:",
    "     pnpm apply:catalog-curation --dry-run ../../data/catalog-curation-export-….xlsx",
    "     pnpm apply:catalog-curation --apply ../../data/catalog-curation-export-….xlsx",
    "",
    "Phase 1 — NAME (yellow REVIEW_* columns):",
    "  REVIEW_canonical_name = collapse target (e.g. Belle Meade).",
    "  REVIEW_expression = variant within that line (e.g. old Sherry Cask Finish).",
    "  REVIEW_age / REVIEW_release_label = schema + tasting chip detail.",
    "  White proposed_* columns are script suggestions only — never edit those.",
    "",
    "Phase 2 — COLLAPSE (REVIEW_collapse, after names are clean):",
    "  `proposed_*` columns re-computed from cleaned names — collapse aggressively.",
    "  Variant year/batch/barrel → REVIEW_release_label on the tasting, not a new row.",
    "  REVIEW_vintages_matter — leave N (default). Product pages do not group by year.",
    "",
    "Sort order: tier → distillery → brand → proposed canonical → current name.",
    "",
    "Yellow REVIEW_* = your edits. Re-export copies them verbatim (by product_id).",
    "  Use --tier=3 to export one tier → data/catalog-curation-tier3-review.xlsx",
    "  Tier exports merge prior yellow columns from the master sheet when present.",
    "  Use --fresh to reset REVIEW_* from script proposals.",
    "  Use --merge-from path.xlsx to merge edits from another file.",
    "  Use --merge-all-tiers to pull REVIEW_* from data/catalog-curation-tier{N}-review.xlsx.",
    "",
    mergePath
      ? `Merged REVIEW_* from: ${mergePath} (${savedReviews.size} rows in merge source)`
      : "No prior REVIEW_* merge (new export or --fresh).",
    tierFilter
      ? `Tier scope: ${[...tierFilter].sort().join(", ")} only`
      : "Tier scope: all tiers",
    "",
    `Exported: ${new Date().toISOString()} · ${rows.length} bourbons`,
  ];
  for (const line of instructions) readme.addRow([line]);
  readme.getColumn(1).width = 110;

  const ws = wb.addWorksheet("Curate", { views: [{ state: "frozen", ySplit: 1 }] });

  const headers = [
    "product_id",
    "tier",
    "distillery",
    "brand",
    "name",
    "age",
    "year_made",
    "whiskey_type",
    "expression_type",
    "rarity",
    "proof",
    "group_size",
    "is_survivor",
    "proposed_collapse",
    "has_image",
    "has_apify",
    "review_count",
    "proposed_brand",
    "proposed_expression",
    "proposed_canonical_name",
    "proposed_spirit_type",
    "proposed_release_label",
    "proposed_vintages_matter",
    "proposed_release_pattern",
    "skip_reason",
    "REVIEW_brand",
    "REVIEW_expression",
    "REVIEW_canonical_name",
    "REVIEW_age",
    "REVIEW_year_made",
    "REVIEW_release_label",
    "REVIEW_tier",
    "REVIEW_distillery",
    "REVIEW_whiskey_type",
    "REVIEW_spirit_type",
    "REVIEW_expression_type",
    "REVIEW_rarity",
    "REVIEW_vintages_matter",
    "REVIEW_release_pattern",
    "REVIEW_collapse",
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

  for (const r of rows) {
    const p = r.proposal;
    const specs = r.specs;
    const cleanup = cleanCatalogDisplayName(r);
    const tier = specNum(specs, "tier");
    const tierN = typeof tier === "number" ? tier : null;
    const rarity =
      specStr(specs, "availability_rarity") ||
      (tierN != null ? (tierToRarityLabel(tierN) ?? "") : "");
    const rev = reviews.get(r.id);

    const defaults = defaultReviewRow(p, r, cleanup, specs, tier, rarity);
    const review = mergeReview(defaults, savedReviews.get(r.id), !fresh);

    ws.addRow([
      r.id,
      tier,
      specStr(specs, "distillery"),
      r.brand ?? "",
      r.name,
      ageDisplay(specs),
      specNum(specs, "year_made"),
      specStr(specs, "whiskey_type"),
      specStr(specs, "expression_type"),
      rarity,
      specNum(specs, "proof"),
      groupSizes.get(p.canonical_name) ?? 1,
      p.is_survivor ? "Y" : "N",
      p.collapse ? "Y" : "N",
      r.image_url ? "Y" : "N",
      rev?.hasApify ? "Y" : "N",
      rev?.count ?? 0,
      p.canonical_brand ?? r.brand ?? "",
      p.expression_label ?? "",
      p.canonical_name,
      p.spirit_type ?? "",
      p.release_label ?? cleanup.releaseLabel ?? "",
      "N",
      p.release_pattern ?? cleanup.releasePattern ?? "",
      p.skip_reason ?? "",
      review.REVIEW_brand ?? "",
      review.REVIEW_expression ?? "",
      review.REVIEW_canonical_name ?? "",
      review.REVIEW_age ?? "",
      review.REVIEW_year_made ?? "",
      review.REVIEW_release_label ?? "",
      review.REVIEW_tier ?? "",
      review.REVIEW_distillery ?? "",
      review.REVIEW_whiskey_type ?? "",
      review.REVIEW_spirit_type ?? "",
      review.REVIEW_expression_type ?? "",
      review.REVIEW_rarity ?? "",
      review.REVIEW_vintages_matter ?? "N",
      review.REVIEW_release_pattern ?? "",
      review.REVIEW_collapse ?? "N",
      review.REVIEW_keep ?? "Y",
      review.REVIEW_notes ?? "",
    ]);
  }

  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: rows.length + 1, column: headers.length },
  };

  const reviewStart = headers.indexOf("REVIEW_brand") + 1;
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
    name: 46,
    cleaned_name: 40,
    distillery: 28,
    proposed_canonical_name: 40,
    REVIEW_canonical_name: 40,
    REVIEW_expression: 32,
    REVIEW_notes: 36,
    skip_reason: 28,
    tier_rationale: 40,
  };
  for (const [i, h] of headers.entries()) {
    ws.getColumn(i + 1).width = widths[h] ?? 14;
  }

  // Brand summary for navigation
  const brands = wb.addWorksheet("By brand");
  brands.addRow(["REVIEW_brand", "row_count", "collapse_candidates", "sample_names"]);
  brands.getRow(1).font = { bold: true };
  const brandGroups = new Map<string, { count: number; collapse: number; samples: string[] }>();
  for (const r of rows) {
    const brand = r.proposal.canonical_brand ?? r.brand ?? "(none)";
    const g = brandGroups.get(brand) ?? { count: 0, collapse: 0, samples: [] };
    g.count += 1;
    if (r.proposal.collapse) g.collapse += 1;
    if (g.samples.length < 3) g.samples.push(r.name);
    brandGroups.set(brand, g);
  }
  for (const [brand, g] of [...brandGroups.entries()].sort(
    (a, b) => b[1].count - a[1].count,
  )) {
    brands.addRow([brand, g.count, g.collapse, g.samples.join(" | ")]);
  }

  await wb.xlsx.writeFile(outPath);

  if (mergePath && !fresh && savedReviews.size > 0) {
    const verify = await loadSavedReviews(outPath, "full");
    let mismatches = 0;
    for (const [id, source] of savedReviews) {
      const written = verify.get(id);
      if (!written) continue;
      for (const key of REVIEW_COLUMNS) {
        if ((source[key] ?? "") !== (written[key] ?? "")) mismatches += 1;
      }
    }
    if (mismatches > 0) {
      console.error(
        `[export-catalog-curation] ERROR: ${mismatches} REVIEW_* cells differ from merge source — export is corrupt`,
      );
      process.exit(1);
    }
    console.log(
      `[export-catalog-curation] verified ${savedReviews.size} rows — all REVIEW_* match merge source`,
    );
  }

  const collapseCount = rows.filter((r) => r.proposal.collapse).length;
  const mergedCount = [...savedReviews.keys()].filter((id) =>
    products.some((p) => p.id === id),
  ).length;
  console.log(`[export-catalog-curation] wrote ${rows.length} rows → ${outPath}`);
  console.log(`[export-catalog-curation] proposed collapse variants: ${collapseCount}`);
  console.log(`[export-catalog-curation] brands: ${brandGroups.size}`);
  if (mergePath && !fresh) {
    console.log(`[export-catalog-curation] preserved REVIEW_* for ${mergedCount} rows from ${mergePath}`);
  }
}

main().catch((err) => {
  console.error("[export-catalog-curation] failed:", err);
  process.exit(1);
});
