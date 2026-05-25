/**
 * Sync specs.curation_collapse from REVIEW_collapse in catalog-curation-audit.xlsx.
 * Curation apply updates names/expressions but defers collapse flags until this step.
 *
 *   pnpm sync:collapse-flags
 *   pnpm sync:collapse-flags --apply
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { adminClient } from "./lib/supabase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_XLSX = path.resolve(__dirname, "../../../../data/catalog-curation-audit.xlsx");

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

function yn(v: unknown): "Y" | "N" | null {
  const s = str(v)?.toUpperCase();
  if (s === "Y" || s === "YES" || s === "TRUE") return "Y";
  if (s === "N" || s === "NO" || s === "FALSE") return "N";
  return null;
}

async function loadRows(xlsxPath: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const ws = wb.worksheets.find((s) => s.name !== "README");
  if (!ws) throw new Error("No data sheet found");

  const hmap = new Map<string, number>();
  ws.getRow(1).eachCell((cell, col) => {
    hmap.set(String(cell.value ?? ""), col);
  });
  const get = (row: ExcelJS.Row, key: string) => {
    const col = hmap.get(key);
    return col ? cellValue(row.getCell(col).value) : null;
  };

  const rows: { product_id: string; collapse: "Y" | "N" }[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const id = str(get(row, "product_id"));
    const collapse = yn(get(row, "REVIEW_collapse"));
    if (!id || !collapse) continue;
    rows.push({ product_id: id, collapse });
  }
  return rows;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const xlsxPath = process.argv.find((a) => a.endsWith(".xlsx"))
    ? path.resolve(process.argv.find((a) => a.endsWith(".xlsx"))!)
    : DEFAULT_XLSX;

  console.log(`[sync-collapse-flags] ${apply ? "APPLY" : "DRY RUN"} ← ${xlsxPath}`);

  const rows = await loadRows(xlsxPath);
  const yCount = rows.filter((r) => r.collapse === "Y").length;
  const nCount = rows.filter((r) => r.collapse === "N").length;
  console.log(`[sync-collapse-flags] ${rows.length} rows (${yCount} Y, ${nCount} N)`);

  const supa = adminClient();
  const existing = new Map<string, Record<string, unknown> | null>();

  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100).map((r) => r.product_id);
    const { data, error } = await supa.from("products").select("id, specs").in("id", chunk);
    if (error) throw error;
    for (const p of data ?? []) existing.set(p.id, p.specs as Record<string, unknown> | null);
  }

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const cur = existing.get(row.product_id);
    if (!cur) {
      console.warn(`  skip missing ${row.product_id}`);
      continue;
    }
    if (cur.curation_collapse === row.collapse) {
      skipped += 1;
      continue;
    }
    // Aggressive: never downgrade a row already marked Y (e.g. fixup overrides).
    if (row.collapse === "N" && cur.curation_collapse === "Y") {
      skipped += 1;
      continue;
    }
    updated += 1;
    if (updated <= 15) {
      console.log(`  ${row.product_id}: ${cur.curation_collapse ?? "?"} → ${row.collapse}`);
    }
    if (apply) {
      const { error } = await supa
        .from("products")
        .update({ specs: { ...cur, curation_collapse: row.collapse } })
        .eq("id", row.product_id);
      if (error) throw error;
    }
  }

  console.log(
    `[sync-collapse-flags] would update=${updated} unchanged=${skipped}${apply ? " (written)" : " — pass --apply to write"}`,
  );
}

main().catch((err) => {
  console.error("[sync-collapse-flags] failed:", err);
  process.exit(1);
});
