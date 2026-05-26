/**
 * Merge REVIEW_tier (and related schema REVIEW_*) from tier slice sheets
 * back into the master catalog-curation-review.xlsx.
 *
 * Tier slice exports only contain rows that were tier N at export time — edits
 * in tier3/4/5 xlsx do not automatically update the master file.
 *
 *   pnpm merge:curation-tiers --dry-run
 *   pnpm merge:curation-tiers --write
 *   pnpm merge:curation-tiers --write --apply-db   # also push tiers to Supabase
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { copyFileSync, existsSync } from "node:fs";
import ExcelJS from "exceljs";
import { adminClient } from "./lib/supabase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../../../data");
const MASTER_PATH = path.join(DATA_DIR, "catalog-curation-review.xlsx");

const REVIEW_KEYS = [
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

type TierReview = Partial<Record<(typeof REVIEW_KEYS)[number], string>>;

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
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    map.set(String(cell.value ?? ""), col);
  });
  return map;
}

async function loadTierReviews(xlsxPath: string): Promise<Map<string, TierReview>> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const ws = wb.getWorksheet("Curate");
  if (!ws) return new Map();

  const hmap = buildHeaderMap(ws);
  const idCol = hmap.get("product_id");
  if (!idCol) return new Map();

  const byId = new Map<string, TierReview>();
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const id = cellStr(cellValue(row.getCell(idCol).value));
    if (!/^[0-9a-f-]{36}$/i.test(id)) continue;

    const review: TierReview = {};
    for (const key of REVIEW_KEYS) {
      const col = hmap.get(key);
      if (!col) continue;
      const val = cellStr(cellValue(row.getCell(col).value));
      if (val) review[key] = val;
    }
    if (Object.keys(review).length > 0) byId.set(id, review);
  }
  return byId;
}

function tierSlicePaths(): string[] {
  const paths: string[] = [];
  for (let t = 1; t <= 5; t++) {
    const p = path.join(DATA_DIR, `catalog-curation-tier${t}-review.xlsx`);
    if (existsSync(p)) paths.push(p);
  }
  return paths;
}

async function applyTiersToDb(merged: Map<string, TierReview>, dryRun: boolean) {
  const supa = adminClient();
  let updated = 0;

  for (const [id, review] of merged) {
    const tierRaw = review.REVIEW_tier;
    if (!tierRaw || !/^[1-5]$/.test(tierRaw)) continue;

    const tier = Number.parseInt(tierRaw, 10);
    const { data: product, error: loadErr } = await supa
      .from("products")
      .select("specs")
      .eq("id", id)
      .eq("type", "bourbon")
      .maybeSingle();
    if (loadErr) throw loadErr;
    if (!product) continue;

    const specs = { ...((product.specs as Record<string, unknown> | null) ?? {}) };
    if (specs.tier === tier && specs.tier_source === "curation") continue;

    specs.tier = tier;
    specs.tier_source = "curation";
    if (review.REVIEW_rarity) specs.availability_rarity = review.REVIEW_rarity;
    if (review.REVIEW_distillery) specs.distillery = review.REVIEW_distillery;
    if (review.REVIEW_whiskey_type) specs.whiskey_type = review.REVIEW_whiskey_type;
    if (review.REVIEW_spirit_type) specs.spirit_type = review.REVIEW_spirit_type;
    if (review.REVIEW_age) specs.age_label = review.REVIEW_age;

    updated += 1;
    if (!dryRun) {
      const { error } = await supa.from("products").update({ specs }).eq("id", id);
      if (error) throw error;
    }
  }

  console.log(`[merge:curation-tiers] DB ${dryRun ? "would update" : "updated"} ${updated} products`);
}

async function main() {
  const write = process.argv.includes("--write");
  const dryRun = !write;
  const applyDb = process.argv.includes("--apply-db");

  const slicePaths = tierSlicePaths();
  if (!slicePaths.length) {
    console.error("[merge:curation-tiers] No catalog-curation-tier{N}-review.xlsx files found in data/");
    process.exit(1);
  }

  const merged = new Map<string, TierReview>();
  for (const p of slicePaths) {
    const chunk = await loadTierReviews(p);
    console.log(`[merge:curation-tiers] ${path.basename(p)} → ${chunk.size} rows with tier edits`);
    for (const [id, review] of chunk) {
      merged.set(id, { ...merged.get(id), ...review });
    }
  }

  if (!existsSync(MASTER_PATH)) {
    console.error(`[merge:curation-tiers] Missing master: ${MASTER_PATH}`);
    process.exit(1);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(MASTER_PATH);
  const ws = wb.getWorksheet("Curate");
  if (!ws) throw new Error('Master missing "Curate" sheet');

  const hmap = buildHeaderMap(ws);
  const idCol = hmap.get("product_id");
  if (!idCol) throw new Error("Master missing product_id column");

  let patched = 0;
  let tierChanges = 0;

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const id = cellStr(cellValue(row.getCell(idCol).value));
    const review = merged.get(id);
    if (!review) continue;

    let rowPatched = false;
    for (const key of REVIEW_KEYS) {
      const val = review[key];
      if (!val) continue;
      const col = hmap.get(key);
      if (!col) continue;
      const cell = row.getCell(col);
      const before = cellStr(cellValue(cell.value));
      if (before !== val) {
        if (key === "REVIEW_tier") tierChanges += 1;
        if (write) cell.value = val;
        rowPatched = true;
      }
    }
    if (rowPatched) patched += 1;
  }

  console.log(
    `[merge:curation-tiers] ${dryRun ? "would patch" : "patched"} ${patched} master rows (${tierChanges} REVIEW_tier changes)`,
  );

  if (write) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const backup = MASTER_PATH.replace(/\.xlsx$/i, `.backup-${stamp}.xlsx`);
    copyFileSync(MASTER_PATH, backup);
    await wb.xlsx.writeFile(MASTER_PATH);
    console.log(`[merge:curation-tiers] backup → ${backup}`);
    console.log(`[merge:curation-tiers] wrote → ${MASTER_PATH}`);
  } else {
    console.log("[merge:curation-tiers] Re-run with --write to update master.");
  }

  if (applyDb) {
    await applyTiersToDb(merged, dryRun);
  }

  if (!dryRun) {
    console.log(
      "[merge:curation-tiers] Next: pnpm export:catalog-curation  (refreshes white tier column from DB)",
    );
  }
}

main().catch((err) => {
  console.error("[merge:curation-tiers] failed:", err);
  process.exit(1);
});
