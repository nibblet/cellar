/**
 * Backfill specs.known_release_labels on collapsed parent expressions.
 *
 * Reads catalog-curation-review.xlsx and matches variant rows to live catalog
 * parents by name prefix / canonical name.
 *
 *   pnpm backfill:known-release-labels --dry-run
 *   pnpm backfill:known-release-labels --apply
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import {
  KNOWN_RELEASE_LABELS_KEY,
  labelsFromSpecs,
  mergeKnownReleaseLabels,
} from "@/lib/tasting/known-release-labels";
import { adminClient } from "./lib/supabase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_XLSX = path.resolve(
  __dirname,
  "../../../../data/catalog-curation-review.xlsx",
);

type CurationRow = {
  product_id: string;
  name: string;
  proposed_canonical_name: string | null;
  review_canonical_name: string | null;
  review_collapse: boolean;
  year_made: number | null;
  review_release_label: string | null;
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

function extractLabelFromName(name: string): string | null {
  const year = name.match(/\b(19|20)\d{2}\b/);
  if (year) return year[0];
  const barrel = name.match(/Barrel\s*#?\s*(\d+)/i);
  if (barrel) return `#${barrel[1]}`;
  return null;
}

function rowLabel(row: CurationRow): string | null {
  return (
    row.review_release_label ??
    (row.year_made != null ? String(row.year_made) : null) ??
    extractLabelFromName(row.name)
  );
}

async function loadCurationRows(xlsxPath: string): Promise<CurationRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const ws = wb.getWorksheet("Curate");
  if (!ws) throw new Error('Missing "Curate" sheet');

  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = String(cell.value ?? "");
  });
  const get = (row: ExcelJS.Row, key: string) => {
    const i = headers.indexOf(key);
    return i >= 0 ? cellValue(row.getCell(i + 1).value) : null;
  };

  const rows: CurationRow[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const product_id = str(get(row, "product_id"));
    const name = str(get(row, "name"));
    if (!product_id || !name) continue;
    rows.push({
      product_id,
      name,
      proposed_canonical_name: str(get(row, "proposed_canonical_name")),
      review_canonical_name: str(get(row, "REVIEW_canonical_name")),
      review_collapse: str(get(row, "REVIEW_collapse"))?.toUpperCase() === "Y",
      year_made: num(get(row, "year_made")),
      review_release_label: str(get(row, "REVIEW_release_label")),
    });
  }
  return rows;
}

function matchesParent(
  row: CurationRow,
  product: { id: string; name: string },
): boolean {
  if (row.product_id === product.id) return true;
  if (row.name === product.name) return true;
  if (row.proposed_canonical_name === product.name) return true;
  return false;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;
  const xlsxPath = process.argv.find((a) => a.endsWith(".xlsx"))
    ? path.resolve(process.argv.find((a) => a.endsWith(".xlsx"))!)
    : DEFAULT_XLSX;

  console.log(`[backfill-known-release-labels] ${dryRun ? "DRY RUN" : "APPLY"} ← ${xlsxPath}`);

  const curationRows = await loadCurationRows(xlsxPath);
  const supa = adminClient();
  const products: Array<{ id: string; name: string; specs: Record<string, unknown> | null }> = [];

  for (let from = 0; ; from += 1000) {
    const { data, error } = await supa
      .from("products")
      .select("id, name, specs")
      .eq("type", "bourbon")
      .eq("status", "confirmed")
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    products.push(...(data as typeof products));
  }

  let updated = 0;
  for (const product of products) {
    const labels = new Set<string>();
    for (const row of curationRows) {
      if (!matchesParent(row, product)) continue;
      const label = rowLabel(row);
      if (label) labels.add(label);
    }

    if (labels.size === 0) continue;

    const merged = mergeKnownReleaseLabels(labelsFromSpecs(product.specs), [...labels]);
    const existing = labelsFromSpecs(product.specs);
    if (existing.length === merged.length && existing.every((label, i) => label === merged[i])) {
      continue;
    }

    console.log(`  ${product.name.slice(0, 42).padEnd(42)} → ${merged.join(", ")}`);
    updated += 1;

    if (!dryRun) {
      const specs = { ...(product.specs ?? {}), [KNOWN_RELEASE_LABELS_KEY]: merged };
      const { error } = await supa.from("products").update({ specs }).eq("id", product.id);
      if (error) throw error;
    }
  }

  console.log(`[backfill-known-release-labels] updated=${updated}`);
  if (dryRun) console.log("[backfill-known-release-labels] Re-run with --apply to write.");
}

main().catch((err) => {
  console.error("[backfill-known-release-labels] failed:", err);
  process.exit(1);
});
