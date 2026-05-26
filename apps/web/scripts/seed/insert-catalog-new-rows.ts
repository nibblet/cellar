/**
 * Insert new bourbon products from the catalog audit spreadsheet.
 *
 * Finds rows where product_id is empty but REVIEW_keep=Y, inserts them
 * into the products table, then writes the new UUIDs back into the
 * spreadsheet so the main apply script can process them.
 *
 *   pnpm tsx --env-file=.env.local scripts/seed/insert-catalog-new-rows.ts --dry-run
 *   pnpm tsx --env-file=.env.local scripts/seed/insert-catalog-new-rows.ts --apply
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { adminClient } from "./lib/supabase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const XLSX_PATH = path.resolve(
  __dirname,
  "../../../../data/catalog-curation-audit-working.xlsx",
);

function str(v: ExcelJS.CellValue): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "object" && "result" in v) v = (v as { result: unknown }).result as ExcelJS.CellValue;
  const s = String(v).trim();
  return s || null;
}

function yn(v: ExcelJS.CellValue): boolean {
  const s = str(v)?.toUpperCase();
  return s === "Y" || s === "YES" || s === "TRUE" || s === "1";
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;

  console.log(`[insert-new-rows] ${dryRun ? "DRY RUN" : "APPLY"}`);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);
  const ws = wb.getWorksheet("Curate");
  if (!ws) throw new Error('Missing "Curate" sheet');

  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = String(cell.value ?? "");
  });

  const col = (name: string) => headers.indexOf(name) + 1;
  const getCell = (row: ExcelJS.Row, name: string) => {
    const idx = col(name);
    return idx > 0 ? row.getCell(idx).value : null;
  };

  const supa = adminClient();
  let inserted = 0;

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const productId = str(getCell(row, "product_id"));
    const keep = yn(getCell(row, "REVIEW_keep"));

    if (productId || !keep) continue;

    const canonicalName = str(getCell(row, "REVIEW_canonical_name"));
    const brand = str(getCell(row, "REVIEW_brand"));
    if (!canonicalName) continue;

    const tierVal = str(getCell(row, "REVIEW_tier"));
    const tier = tierVal ? Number.parseInt(tierVal, 10) : null;

    const specs: Record<string, unknown> = {};
    const setSpec = (key: string, value: string | null) => {
      if (value) specs[key] = value;
    };

    setSpec("distillery", str(getCell(row, "REVIEW_distillery")));
    setSpec("whiskey_type", str(getCell(row, "REVIEW_whiskey_type")));
    setSpec("expression_type", str(getCell(row, "REVIEW_expression_type")));
    setSpec("spirit_type", str(getCell(row, "REVIEW_spirit_type")));
    setSpec("availability_rarity", str(getCell(row, "REVIEW_rarity")));
    setSpec("age_label", str(getCell(row, "REVIEW_age")));
    setSpec("curation_notes", str(getCell(row, "REVIEW_notes")));
    setSpec("curation_release_label", str(getCell(row, "REVIEW_release_label")));

    const yearMade = str(getCell(row, "REVIEW_year_made"));
    if (yearMade) specs.year_made = Number.parseInt(yearMade, 10) || undefined;

    if (tier) {
      specs.tier = tier;
      specs.tier_source = "curation";
    }

    specs.curation_collapse = yn(getCell(row, "REVIEW_collapse")) ? "Y" : "N";

    const vintagesMatter = yn(getCell(row, "REVIEW_vintages_matter"));
    const releasePattern = str(getCell(row, "REVIEW_release_pattern"));

    console.log(`  INSERT ${canonicalName} | brand=${brand} | T${tier} | rarity=${specs.availability_rarity}`);

    if (!dryRun) {
      const { data, error } = await supa
        .from("products")
        .insert({
          type: "bourbon" as const,
          name: canonicalName,
          brand,
          specs,
          status: "confirmed" as const,
          source: "manual" as const,
          vintages_matter: vintagesMatter,
          release_pattern: releasePattern,
        })
        .select("id")
        .single();

      if (error) throw error;

      row.getCell(col("product_id")).value = data.id;
      console.log(`    → id=${data.id}`);
    }

    inserted++;
  }

  console.log(`[insert-new-rows] inserted=${inserted}`);

  if (!dryRun && inserted > 0) {
    await wb.xlsx.writeFile(XLSX_PATH);
    console.log(`[insert-new-rows] UUIDs written back to spreadsheet`);
  }

  if (dryRun) console.log("[insert-new-rows] Re-run with --apply to write.");
}

main().catch((err) => {
  console.error("[insert-new-rows] failed:", err);
  process.exit(1);
});
