/**
 * Restore Weller shelf expressions + BTAC parent after bad collapse merge.
 *
 *   pnpm restore:weller --dry-run
 *   pnpm restore:weller --apply
 *
 * Uses reference columns from catalog-curation-review.xlsx (not REVIEW_canonical_name).
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { adminClient } from "./lib/supabase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_XLSX = path.resolve(
  __dirname,
  "../../../../data/catalog-curation-review.xlsx",
);

const SHELF_IDS = new Set([
  "42806bc0-a625-41b7-aa2b-8dbdd184a6e0", // Special Reserve
  "11522d27-ad80-4200-8fe6-517cae5e0ea7", // Weller 12 Year
  "c110f18f-6efd-470b-a2b2-7523ae261344", // Antique 107
]);

const CYPB_ID = "8b5cc01d-b4c4-4b11-ae16-6dd3059cd8ca";
const BTAC_SURVIVOR_ID = "6696a8d1-f8fd-4a2a-8b01-0051bd89eea7";

type SheetRow = {
  product_id: string;
  brand: string;
  name: string;
  tier: number | null;
  distillery: string | null;
  age: string | null;
  year_made: number | null;
  whiskey_type: string | null;
  expression_type: string | null;
  rarity: string | null;
  proof: number | null;
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

function buildSpecs(row: SheetRow): Record<string, unknown> {
  const specs: Record<string, unknown> = { curation_collapse: "N" };
  if (row.distillery) specs.distillery = row.distillery;
  if (row.whiskey_type) specs.whiskey_type = row.whiskey_type;
  if (row.expression_type) specs.expression_type = row.expression_type;
  if (row.age) specs.age_label = row.age;
  if (row.year_made != null) specs.year_made = row.year_made;
  if (row.tier != null) {
    specs.tier = row.tier;
    specs.tier_source = "curation";
  }
  if (row.rarity) specs.availability_rarity = row.rarity;
  if (row.proof != null) {
    specs.proof = row.proof;
    specs.abv = row.proof / 2;
  }
  return specs;
}

async function loadWellerRows(xlsxPath: string): Promise<Map<string, SheetRow>> {
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

  const byId = new Map<string, SheetRow>();
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const product_id = str(get(row, "product_id"));
    if (!product_id) continue;
    const brand = str(get(row, "brand")) ?? "";
    const name = str(get(row, "name")) ?? "";
    if (!/weller/i.test(`${brand} ${name}`)) continue;

    byId.set(product_id, {
      product_id,
      brand,
      name,
      tier: tier(get(row, "tier")),
      distillery: str(get(row, "distillery")),
      age: str(get(row, "age")),
      year_made: num(get(row, "year_made")),
      whiskey_type: str(get(row, "whiskey_type")),
      expression_type: str(get(row, "expression_type")),
      rarity: str(get(row, "rarity")),
      proof: num(get(row, "proof")),
    });
  }
  return byId;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;
  const xlsxPath = process.argv.find((a) => a.endsWith(".xlsx"))
    ? path.resolve(process.argv.find((a) => a.endsWith(".xlsx"))!)
    : DEFAULT_XLSX;

  console.log(`[restore-weller] ${dryRun ? "DRY RUN" : "APPLY"} ← ${xlsxPath}`);
  const rows = await loadWellerRows(xlsxPath);
  const supa = adminClient();

  const restoreIds = [...SHELF_IDS, BTAC_SURVIVOR_ID];
  let inserted = 0;
  let updated = 0;

  for (const id of restoreIds) {
    const row = rows.get(id);
    if (!row) {
      console.warn(`[restore-weller] missing sheet row for ${id}`);
      continue;
    }

    const isBtac = id === BTAC_SURVIVOR_ID;
    const patch = {
      id,
      type: "bourbon" as const,
      name: isBtac ? "William Larue Weller" : row.name,
      brand: isBtac ? "William Larue Weller" : row.brand,
      specs: {
        ...buildSpecs(row),
        ...(isBtac ? { curation_collapse: "Y" } : {}),
      },
      status: "confirmed" as const,
      source: "seed" as const,
      vintages_matter: false,
      release_pattern: isBtac ? ("year" as const) : null,
    };

    const { data: existing } = await supa.from("products").select("id,name").eq("id", id).maybeSingle();
    if (existing) {
      console.log(`  UPDATE ${existing.name} → ${patch.name} (${patch.brand})`);
      if (!dryRun) {
        const { error } = await supa.from("products").update(patch).eq("id", id);
        if (error) throw error;
      }
      updated += 1;
      continue;
    }

    console.log(`  INSERT ${patch.name} (${patch.brand})`);
    if (!dryRun) {
      const { error } = await supa.from("products").insert(patch);
      if (error) throw error;
    }
    inserted += 1;
  }

  const cypb = rows.get(CYPB_ID);
  if (cypb) {
    const { data: survivor } = await supa.from("products").select("id,name,brand").eq("id", CYPB_ID).maybeSingle();
    if (survivor) {
      const patch = {
        name: cypb.name,
        brand: cypb.brand,
        specs: buildSpecs(cypb),
        release_pattern: null,
        vintages_matter: false,
      };
      console.log(`  FIX CYPB ${survivor.name} → ${patch.name} (${patch.brand})`);
      if (!dryRun) {
        const { error } = await supa.from("products").update(patch).eq("id", CYPB_ID);
        if (error) throw error;
      }
      updated += 1;
    }
  }

  console.log(`[restore-weller] inserted=${inserted} updated=${updated}`);
  if (dryRun) console.log("[restore-weller] Re-run with --apply to write.");
}

main().catch((err) => {
  console.error("[restore-weller] failed:", err);
  process.exit(1);
});
