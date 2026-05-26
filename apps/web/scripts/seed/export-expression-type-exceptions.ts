/**
 * Export comma-separated or ambiguous expression_type rows for focused review.
 *
 *   pnpm export:expression-type-exceptions
 *   pnpm export:expression-type-exceptions ~/path/to/curation.xlsx
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { normalizeExpressionType } from "@/lib/catalog/normalize-expression-type";
import { displayName, parseCurateRows, rawExpressionType } from "./lib/curation-restore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_XLSX = path.resolve(
  __dirname,
  "../../../../data/catalog-curation-review.xlsx",
);
const DEFAULT_OUT = path.resolve(
  __dirname,
  "../../../../data/catalog-expression-type-exceptions.xlsx",
);

async function main() {
  const xlsxPath = process.argv.find((a) => a.endsWith(".xlsx") && !a.includes("exceptions"))
    ? path.resolve(process.argv.find((a) => a.endsWith(".xlsx") && !a.includes("exceptions"))!)
    : DEFAULT_XLSX;
  const outPath = process.argv.find((a) => a.includes("exceptions") && a.endsWith(".xlsx"))
    ? path.resolve(process.argv.find((a) => a.includes("exceptions") && a.endsWith(".xlsx"))!)
    : DEFAULT_OUT;

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const ws = wb.getWorksheet("Curate");
  if (!ws) throw new Error('Missing "Curate" sheet');

  const rows = parseCurateRows(ws, (r) => r.review_keep);
  const exceptions: Array<{
    product_id: string;
    name: string;
    brand: string;
    raw_expression_type: string;
    normalized_expression_type: string;
    expression_modifier: string;
    needs_review: string;
    curated_expression: string;
  }> = [];

  for (const row of rows.values()) {
    const raw = rawExpressionType(row) ?? "";
    const normalized = normalizeExpressionType(raw);
    if (!raw.includes(",") && !normalized.needs_review) continue;

    exceptions.push({
      product_id: row.product_id,
      name: displayName(row),
      brand: row.review_brand ?? row.brand,
      raw_expression_type: raw,
      normalized_expression_type: normalized.expression_type ?? "",
      expression_modifier: normalized.expression_modifier ?? "",
      needs_review: normalized.needs_review ? "Y" : "N",
      curated_expression: row.review_expression ?? "",
    });
  }

  const out = new ExcelJS.Workbook();
  const sheet = out.addWorksheet("Exceptions");
  sheet.columns = [
    { header: "product_id", key: "product_id", width: 38 },
    { header: "name", key: "name", width: 48 },
    { header: "brand", key: "brand", width: 28 },
    { header: "raw_expression_type", key: "raw_expression_type", width: 40 },
    { header: "normalized_expression_type", key: "normalized_expression_type", width: 28 },
    { header: "expression_modifier", key: "expression_modifier", width: 32 },
    { header: "needs_review", key: "needs_review", width: 12 },
    { header: "curated_expression", key: "curated_expression", width: 24 },
  ];
  for (const row of exceptions) sheet.addRow(row);

  await out.xlsx.writeFile(outPath);
  console.log(
    `[export:expression-type-exceptions] wrote ${exceptions.length} rows → ${outPath}`,
  );
}

main().catch((err) => {
  console.error("[export:expression-type-exceptions] failed:", err);
  process.exit(1);
});
