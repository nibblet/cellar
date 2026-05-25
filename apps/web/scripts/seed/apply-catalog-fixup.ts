/**
 * Apply FIX_* columns from catalog-curation-fixup.xlsx to Supabase.
 *
 *   pnpm apply:catalog-fixup --dry-run
 *   pnpm apply:catalog-fixup --apply
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { adminClient } from "./lib/supabase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_XLSX = path.resolve(
  __dirname,
  "../../../../data/catalog-curation-fixup.xlsx",
);

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
  if (s === "Y" || s === "YES") return "Y";
  if (s === "N" || s === "NO") return "N";
  return null;
}

async function loadFixups(xlsxPath: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);

  const sheetNames = ["Brand conflicts", "Mixed collapse", "All fixups"];
  const byId = new Map<
    string,
    {
      product_id: string;
      FIX_brand: string | null;
      FIX_collapse: "Y" | "N" | null;
      FIX_notes: string | null;
      REVIEW_brand: string | null;
      REVIEW_collapse: string | null;
    }
  >();

  for (const sheetName of sheetNames) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) continue;

    const hmap = new Map<string, number>();
    ws.getRow(1).eachCell((cell, col) => {
      hmap.set(String(cell.value ?? ""), col);
    });
    const get = (row: ExcelJS.Row, key: string) => {
      const col = hmap.get(key);
      return col ? cellValue(row.getCell(col).value) : null;
    };

    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const id = str(get(row, "product_id"));
      if (!id) continue;

      const fixBrand = str(get(row, "FIX_brand"));
      const fixCollapse = yn(get(row, "FIX_collapse"));
      const fixNotes = str(get(row, "FIX_notes"));
      if (!fixBrand && !fixCollapse && !fixNotes) continue;

      const prev = byId.get(id) ?? {
        product_id: id,
        FIX_brand: null,
        FIX_collapse: null,
        FIX_notes: null,
        REVIEW_brand: str(get(row, "REVIEW_brand")),
        REVIEW_collapse: str(get(row, "REVIEW_collapse")),
      };
      if (fixBrand) prev.FIX_brand = fixBrand;
      if (fixCollapse) prev.FIX_collapse = fixCollapse;
      if (fixNotes) prev.FIX_notes = fixNotes;
      byId.set(id, prev);
    }
  }

  return [...byId.values()];
}

/** "10 year old Sherry" manual strip left "old Sherry" — drop lowercase "old " prefix only. */
export function fixAgeStripArtifactExpression(expr: string): string {
  if (/^old\s+/.test(expr)) return expr.replace(/^old\s+/, "");
  return expr;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;
  const xlsxPath = process.argv.find((a) => a.endsWith(".xlsx"))
    ? path.resolve(process.argv.find((a) => a.endsWith(".xlsx"))!)
    : DEFAULT_XLSX;

  console.log(`[apply-catalog-fixup] ${dryRun ? "DRY RUN" : "APPLY"} ← ${xlsxPath}`);

  const rows = await loadFixups(xlsxPath);
  if (!rows.length) {
    console.log("[apply-catalog-fixup] no FIX_* edits found — fill yellow FIX_ columns first");
    return;
  }

  const supa = adminClient();
  const ids = rows.map((r) => r.product_id);
  const existing = new Map<string, { brand: string | null; specs: Record<string, unknown> | null }>();

  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { data, error } = await supa
      .from("products")
      .select("id, brand, specs")
      .in("id", chunk);
    if (error) throw error;
    for (const p of data ?? []) existing.set(p.id, p);
  }

  let brandUpdates = 0;
  let collapseUpdates = 0;
  let expressionFixes = 0;

  // Fix age-strip artifacts in curated_expression across catalog
  if (apply) {
    const { data: allExpr, error: fetchErr } = await supa
      .from("products")
      .select("id, specs")
      .eq("type", "bourbon")
      .eq("status", "confirmed");
    if (fetchErr) throw fetchErr;
    for (const p of allExpr ?? []) {
      const specs = (p.specs ?? {}) as Record<string, unknown>;
      const expr = specs.curated_expression;
      if (typeof expr !== "string" || !/^old\s+/.test(expr)) continue;
      const fixed = fixAgeStripArtifactExpression(expr);
      if (fixed === expr) continue;
      expressionFixes += 1;
      console.log(`  EXPR ${p.id}: "${expr}" → "${fixed}"`);
      const { error } = await supa
        .from("products")
        .update({ specs: { ...specs, curated_expression: fixed } })
        .eq("id", p.id);
      if (error) throw error;
    }
  } else {
    const { data: allExpr, error: fetchErr } = await supa
      .from("products")
      .select("id, specs")
      .eq("type", "bourbon")
      .eq("status", "confirmed");
    if (fetchErr) throw fetchErr;
    for (const p of allExpr ?? []) {
      const expr = (p.specs as Record<string, unknown> | null)?.curated_expression;
      if (typeof expr === "string" && /^old\s+/.test(expr)) {
        expressionFixes += 1;
        console.log(`  EXPR ${p.id}: "${expr}" → "${fixAgeStripArtifactExpression(expr)}"`);
      }
    }
  }

  for (const row of rows) {
    const cur = existing.get(row.product_id);
    if (!cur) {
      console.warn(`  skip missing ${row.product_id}`);
      continue;
    }

    const specs = { ...(cur.specs ?? {}) };
    let brand = cur.brand;
    let changed = false;

    if (row.FIX_brand && row.FIX_brand !== cur.brand) {
      brand = row.FIX_brand;
      changed = true;
      brandUpdates += 1;
      console.log(`  BRAND ${row.product_id}: ${cur.brand ?? "?"} → ${row.FIX_brand}`);
    }

    if (row.FIX_collapse) {
      const prev = specs.curation_collapse;
      if (prev !== row.FIX_collapse) {
        specs.curation_collapse = row.FIX_collapse;
        changed = true;
        collapseUpdates += 1;
        console.log(
          `  COLLAPSE ${row.product_id}: ${row.REVIEW_collapse ?? "?"} → ${row.FIX_collapse}`,
        );
      }
    }

    if (row.FIX_notes) specs.curation_fixup_notes = row.FIX_notes;

    if (!changed && !row.FIX_notes) continue;

    if (!dryRun) {
      const { error } = await supa
        .from("products")
        .update({ brand, specs })
        .eq("id", row.product_id);
      if (error) throw error;
    }
  }

  console.log(
    `[apply-catalog-fixup] rows with fixes=${rows.length} brand=${brandUpdates} collapse=${collapseUpdates} expression=${expressionFixes}`,
  );
  if (dryRun) console.log("[apply-catalog-fixup] Re-run with --apply to write.");
}

main().catch((err) => {
  console.error("[apply-catalog-fixup] failed:", err);
  process.exit(1);
});
