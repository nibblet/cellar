/**
 * Apply the curated cigar catalog review (xlsx) to Supabase.
 *
 *   pnpm seed:apply-cigar-review --dry-run
 *   pnpm seed:apply-cigar-review --apply
 *   pnpm seed:apply-cigar-review --apply ~/path/to/review.xlsx
 *
 * Reads the "Cigars" sheet as source of truth. Rows not in the sheet are
 * deleted from the cigar catalog. Defaults to data/nccc-cigar-catalog-review_r4.xlsx.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { rollUpTraits } from "@/lib/wheel";
import { adminClient } from "./lib/supabase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_XLSX = path.resolve(
  __dirname,
  "../../../../data/nccc-cigar-catalog-review_r4.xlsx",
);

type ReviewRow = {
  product_id: string;
  brand: string | null;
  name: string;
  vitola: string | null;
  wrapper: string | null;
  binder: string | null;
  filler: string | null;
  country: string | null;
  factory: string | null;
  strength: string | null;
  body: string | null;
  length_inches: number | null;
  ring_gauge: number | null;
  price_tier: number | null;
  msrp_usd: number | null;
  score: number | null;
  status: string | null;
  REVIEW_staple: boolean;
  REVIEW_edition: string | null;
  REVIEW_notes: string | null;
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

function int(v: unknown): number | null {
  const n = num(v);
  if (n == null || !Number.isInteger(n)) return null;
  return n;
}

function keepRow(reviewKeep: string | null): boolean {
  const k = reviewKeep?.toUpperCase();
  return k !== "N";
}

function resolveStatus(row: ReviewRow): "confirmed" | "draft" {
  const raw = row.status?.toLowerCase() ?? "";
  if (raw === "draft") return "draft";
  return "confirmed";
}

function parseCigarsSheet(wb: ExcelJS.Workbook, dbIds: Set<string>): ReviewRow[] {
  const ws = wb.getWorksheet("Cigars");
  if (!ws) throw new Error('Missing "Cigars" sheet');

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
    if (!keepRow(str(get(row, "REVIEW_keep")))) continue;

    rows.push({
      product_id: id,
      brand: str(get(row, "brand")),
      name,
      vitola: str(get(row, "vitola")),
      wrapper: str(get(row, "wrapper")),
      binder: str(get(row, "binder")),
      filler: str(get(row, "filler")),
      country: str(get(row, "country")),
      factory: str(get(row, "factory")),
      strength: str(get(row, "strength")),
      body: str(get(row, "body")),
      length_inches: num(get(row, "length_inches")),
      ring_gauge: int(get(row, "ring_gauge")),
      price_tier: int(get(row, "price_tier")),
      msrp_usd: num(get(row, "msrp_usd")),
      score: int(get(row, "score")),
      status: str(get(row, "status")),
      REVIEW_staple: str(get(row, "REVIEW_staple"))?.toUpperCase() === "Y",
      REVIEW_edition: str(get(row, "REVIEW_edition")),
      REVIEW_notes: str(get(row, "REVIEW_notes")),
      is_new: !dbIds.has(id),
    });
  }
  return rows;
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

  set("vitola", row.vitola);
  set("wrapper", row.wrapper);
  set("wrapper_color", row.wrapper);
  set("binder", row.binder);
  set("filler", row.filler);
  set("country", row.country);
  set("factory", row.factory);
  set("strength", row.strength);
  set("body", row.body);
  set("length_inches", row.length_inches);
  set("ring_gauge", row.ring_gauge);
  set("price_tier", row.price_tier);
  set("msrp_usd", row.msrp_usd);
  set("score", row.score);
  if (row.REVIEW_edition) set("edition", row.REVIEW_edition);
  if (row.REVIEW_staple) merged.club_staple = true;
  if (row.REVIEW_notes) merged.curation_notes = row.REVIEW_notes;
  if (row.is_new) merged.enrichment_pending = true;

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
      .eq("type", "cigar")
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

  console.log(`[apply-cigar-review] ${dryRun ? "DRY RUN" : "APPLY"} ← ${xlsxPath}`);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);

  const dbIds = await fetchDbIds();
  const keepRows = parseCigarsSheet(wb, dbIds);
  const keepIds = new Set(keepRows.map((r) => r.product_id));
  const deleteIds = [...dbIds].filter((id) => !keepIds.has(id));

  const updates = keepRows.filter((r) => !r.is_new);
  const inserts = keepRows.filter((r) => r.is_new);
  const staples = keepRows.filter((r) => r.REVIEW_staple).length;

  console.log(
    `[apply-cigar-review] keep=${keepRows.length} update=${updates.length} insert=${inserts.length} delete=${deleteIds.length} staples=${staples}`,
  );

  const supa = adminClient();

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

    const payload = {
      brand: row.brand,
      name: row.name,
      status: resolveStatus(row),
      specs: buildSpecsPatch(row, (existing.specs ?? null) as Record<string, unknown> | null),
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
      type: "cigar" as const,
      brand: row.brand,
      name: row.name,
      specs,
      wheel_vector: emptyVector,
      trait_vector: rollUpTraits("cigar", emptyVector),
      status: resolveStatus(row),
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

  console.log(
    `[apply-cigar-review] done. updated=${updated} inserted=${inserted} deleted=${deleted} final_catalog≈${keepRows.length}`,
  );

  if (dryRun) {
    console.log("[apply-cigar-review] Re-run with --apply to write changes.");
  }
}

main().catch((err) => {
  console.error("[apply-cigar-review] failed:", err);
  process.exit(1);
});
