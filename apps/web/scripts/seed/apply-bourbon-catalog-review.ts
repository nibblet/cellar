/**
 * Apply Paul’s curated bourbon catalog review (xlsx) to Supabase.
 *
 *   pnpm seed:apply-bourbon-review --dry-run
 *   pnpm seed:apply-bourbon-review --apply
 *   pnpm seed:apply-bourbon-review --apply ~/path/to/review.xlsx
 *
 * Reads the "Bourbons" sheet for updates/inserts and "Duplicates_removed" +
 * REVIEW_keep=N for deletions. Defaults to repo data/nccc-bourbon-catalog-reviewed (2).xlsx.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { rollUpTraits } from "@/lib/wheel";
import { adminClient } from "./lib/supabase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_XLSX = path.resolve(
  __dirname,
  "../../../../data/nccc-bourbon-catalog-reviewed (2).xlsx",
);

const VALID_RARITIES = new Set([
  "everyday",
  "seasonal",
  "allocated",
  "lottery",
  "secondary-only",
  "discontinued",
]);

type ReviewRow = {
  product_id: string;
  brand: string | null;
  name: string;
  distillery: string | null;
  whiskey_type: string | null;
  expression_type: string | null;
  mash_bill: string | null;
  proof: number | null;
  abv: number | null;
  age: string | null;
  price_usd: number | null;
  year_made: number | null;
  in_cobb_collection: boolean;
  REVIEW_tier: number;
  REVIEW_rarity: string | null;
  REVIEW_keep: string | null;
  REVIEW_notes: string | null;
  tier_source: string | null;
  is_new: boolean;
};

function cellValue(raw: ExcelJS.CellValue): unknown {
  if (raw && typeof raw === "object" && "result" in raw) {
    return (raw as { result: unknown }).result;
  }
  return raw;
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s || null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function tier(v: unknown): number | null {
  const n = num(v);
  if (n == null || !Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

function parseBourbonsSheet(wb: ExcelJS.Workbook, dbIds: Set<string>): ReviewRow[] {
  const ws = wb.getWorksheet("Bourbons");
  if (!ws) throw new Error('Missing "Bourbons" sheet');

  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = String(cell.value ?? "");
  });

  const get = (row: ExcelJS.Row, key: string) => {
    const i = headers.indexOf(key);
    return i >= 0 ? cellValue(row.getCell(i + 1).value) : null;
  };

  const rows: ReviewRow[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const id = str(get(row, "product_id"));
    const name = str(get(row, "name"));
    if (!id || !name) continue;

    const reviewTier = tier(get(row, "REVIEW_tier"));
    if (reviewTier == null) throw new Error(`Row ${r}: missing REVIEW_tier for ${name}`);

    const rarity = str(get(row, "REVIEW_rarity"));
    if (rarity && !VALID_RARITIES.has(rarity)) {
      throw new Error(`Row ${r}: invalid REVIEW_rarity "${rarity}"`);
    }

    rows.push({
      product_id: id,
      brand: str(get(row, "brand")),
      name,
      distillery: str(get(row, "distillery")),
      whiskey_type: str(get(row, "whiskey_type")),
      expression_type: str(get(row, "expression_type")),
      mash_bill: str(get(row, "mash_bill")),
      proof: num(get(row, "proof")),
      abv: num(get(row, "abv")),
      age: str(get(row, "age")),
      price_usd: num(get(row, "price_usd")),
      year_made: num(get(row, "year_made")),
      in_cobb_collection: str(get(row, "in_cobb_collection"))?.toUpperCase() === "Y",
      REVIEW_tier: reviewTier,
      REVIEW_rarity: rarity,
      REVIEW_keep: str(get(row, "REVIEW_keep")),
      REVIEW_notes: str(get(row, "REVIEW_notes")),
      tier_source: str(get(row, "tier_source")),
      is_new: !dbIds.has(id),
    });
  }
  return rows;
}

function parseDuplicateIds(wb: ExcelJS.Workbook): string[] {
  const ws = wb.getWorksheet("Duplicates_removed");
  if (!ws) return [];

  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = String(cell.value ?? "");
  });
  const idx = headers.indexOf("product_id");
  if (idx < 0) return [];

  const ids: string[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const id = str(cellValue(ws.getRow(r).getCell(idx + 1).value));
    if (id) ids.push(id);
  }
  return ids;
}

function resolveTierSource(row: ReviewRow, existingSource: string | null): string {
  if (row.tier_source === "manual_add" || row.is_new) return "manual_add";
  if (row.in_cobb_collection || existingSource === "cobb") return "cobb";
  return "manual";
}

function buildSpecsPatch(
  row: ReviewRow,
  existing: Record<string, unknown> | null,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...(existing ?? {}) };

  const set = (key: string, value: unknown) => {
    if (value === null || value === undefined || value === "") return;
    merged[key] = value;
  };

  set("distillery", row.distillery);
  set("whiskey_type", row.whiskey_type);
  set("expression_type", row.expression_type);
  set("mash_bill", row.mash_bill);
  set("proof", row.proof);
  set("abv", row.abv);
  set("price_usd", row.price_usd);
  set("year_made", row.year_made);
  if (row.age) set("age_label", row.age);

  merged.tier = row.REVIEW_tier;
  merged.tier_source = resolveTierSource(row, str(existing?.tier_source));
  if (row.REVIEW_rarity) merged.availability_rarity = row.REVIEW_rarity;
  if (row.REVIEW_notes) merged.curation_notes = row.REVIEW_notes;
  if (row.in_cobb_collection) merged.in_cobb_collection = true;

  return merged;
}

async function fetchDbIds(): Promise<Set<string>> {
  const supa = adminClient();
  const ids = new Set<string>();
  let from = 0;
  while (true) {
    const { data, error } = await supa
      .from("products")
      .select("id")
      .eq("type", "bourbon")
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) ids.add(row.id);
    if (data.length < 1000) break;
    from += 1000;
  }
  return ids;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;
  const xlsxPath = process.argv.find((a) => a.endsWith(".xlsx"))
    ? path.resolve(process.argv.find((a) => a.endsWith(".xlsx"))!)
    : DEFAULT_XLSX;

  console.log(`[apply-bourbon-review] ${dryRun ? "DRY RUN" : "APPLY"} ← ${xlsxPath}`);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);

  const dbIds = await fetchDbIds();
  const rows = parseBourbonsSheet(wb, dbIds);
  const dupeIds = parseDuplicateIds(wb);

  const keepRows = rows.filter((r) => r.REVIEW_keep?.toUpperCase() !== "N");
  const keepIds = new Set(keepRows.map((r) => r.product_id));
  const junkIds = rows.filter((r) => r.REVIEW_keep?.toUpperCase() === "N").map((r) => r.product_id);

  // Bourbons sheet is source of truth — drop any DB row not in the keep set
  // (covers Duplicates_removed, junk, and rows dropped between review passes).
  const deleteIds = [...dbIds].filter((id) => !keepIds.has(id));

  const updates = keepRows.filter((r) => !r.is_new);
  const inserts = keepRows.filter((r) => r.is_new);

  const dupeListed = dupeIds.filter((id) => deleteIds.includes(id)).length;
  console.log(
    `[apply-bourbon-review] keep=${keepRows.length} update=${updates.length} insert=${inserts.length} delete=${deleteIds.length} (junk=${junkIds.length}, dupe_sheet=${dupeListed})`,
  );

  const supa = adminClient();

  if (deleteIds.length) {
    const orphanInKeep = deleteIds.filter((id) => keepIds.has(id));
    if (orphanInKeep.length) {
      throw new Error(`Delete list overlaps kept rows: ${orphanInKeep.slice(0, 3).join(", ")}`);
    }
  }

  let updated = 0;
  let inserted = 0;
  let deleted = 0;

  for (const row of updates) {
    const { data: existing, error: fetchErr } = await supa
      .from("products")
      .select("specs")
      .eq("id", row.product_id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!existing) {
      console.warn(`  skip update — id not in DB: ${row.product_id} (${row.brand} ${row.name})`);
      continue;
    }

    const specs = buildSpecsPatch(row, (existing.specs ?? null) as Record<string, unknown> | null);
    const payload = {
      brand: row.brand,
      name: row.name,
      specs,
    };

    if (dryRun) {
      updated++;
      continue;
    }

    const { error } = await supa.from("products").update(payload).eq("id", row.product_id);
    if (error) throw error;
    updated++;
  }

  for (const row of inserts) {
    const specs = buildSpecsPatch(row, {});
    const emptyVector = {};
    const payload = {
      id: row.product_id,
      type: "bourbon" as const,
      brand: row.brand,
      name: row.name,
      specs: { ...specs, enrichment_pending: true },
      wheel_vector: emptyVector,
      trait_vector: rollUpTraits("bourbon", emptyVector),
      status: "confirmed" as const,
      source: "manual" as const,
    };

    if (dryRun) {
      inserted++;
      continue;
    }

    const { error } = await supa.from("products").insert(payload);
    if (error) throw error;
    inserted++;
  }

  if (deleteIds.length) {
    for (let i = 0; i < deleteIds.length; i += 100) {
      const chunk = deleteIds.slice(i, i + 100);
      if (dryRun) {
        deleted += chunk.length;
        continue;
      }
      const { error } = await supa.from("products").delete().in("id", chunk);
      if (error) throw error;
      deleted += chunk.length;
    }
  }

  const tier12 = keepRows.filter((r) => r.REVIEW_tier === 1 || r.REVIEW_tier === 2).length;
  console.log(
    `[apply-bourbon-review] done. updated=${updated} inserted=${inserted} deleted=${deleted} final_catalog≈${keepRows.length} tier_1_2=${tier12}`,
  );

  if (dryRun) {
    console.log("[apply-bourbon-review] Re-run with --apply to write changes.");
  }
}

main().catch((err) => {
  console.error("[apply-bourbon-review] failed:", err);
  process.exit(1);
});
