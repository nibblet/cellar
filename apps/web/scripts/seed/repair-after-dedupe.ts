/**
 * One-shot repair for the first dedupe pass's three false-positive merges.
 *
 * Three Cobb rows absorbed wrong data because they share token-overlap with
 * a distinct expression / sub-line of the same brand:
 *
 *   1. "Woodford Reserve Distiller's Select Rye, Single Barrel / Barrel
 *      Strength" wrongly absorbed "Woodford Reserve Distiller's Select"
 *      (bourbon).
 *   2. "New Riff Kentucky Straight Rye" wrongly absorbed "New Riff Maltster
 *      Bottled in Bond Kentucky Straight (Rye Recipe)".
 *   3. "Buffalo Trace Single Oak Project Rye Bourbon, Barrel #80" wrongly
 *      absorbed plain "Buffalo Trace".
 *
 * What this script does:
 *   - For each affected Cobb row, recompute its wheel_vector + trait_vector
 *     from its own Tasting Notes (xlsx-derived) only. Reverts the absorbed
 *     bourbonExplorer data.
 *   - Delete product_reviews on those rows where source='bourbonExplorer'
 *     (the wrongly-attached reviews).
 *
 * After this:
 *   - Re-run `pnpm seed:bourbons`. The tightened matcher (R1/R2 in
 *     lib/product-normalizer.ts) will no longer soft-match those three
 *     bourbonExplorer rows onto the Cobb rows. They'll get re-inserted as
 *     fresh confirmed seed rows.
 *
 * Also renames Cobb rows that absorbed line-level batch variants to drop
 * the now-misleading batch / series / release identifier from their names:
 *   - "Elijah Craig Barrel Proof, Batch A125" → "Elijah Craig Barrel Proof"
 *   - "Bardstown Fusion Series #6" → "Bardstown Fusion Series"
 *   - "Maker's Mark Wood Finishing Series 2021 FAE-02" → "Maker's Mark Wood
 *     Finishing Series 2021"
 *   - (Larceny Barrel Proof already line-level — no change)
 *
 * Usage:
 *   pnpm repair:after-dedupe --dry-run    # show what would change
 *   pnpm repair:after-dedupe              # apply
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import {
  buildSynonymIndex,
  matchChip,
  rollUpTraits,
  type WheelVector,
} from "@/lib/wheel";
import { adminClient } from "./lib/supabase-admin";

export {};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const XLSX_DEFAULT_PATH = path.join(__dirname, "data", "private", "cobb-whiskey.xlsx");
const SHEET_NAME = "Whiskey Collection";

// Cobb row name signatures that need their wheel_vector reset.
const WRONG_MERGE_NAMES = new Set([
  "Woodford Reserve Distiller's Select Rye, Single Barrel / Barrel Strength",
  "New Riff Kentucky Straight Rye",
  "Buffalo Trace Single Oak Project Rye Bourbon, Barrel #80",
]);

// Cobb row name rewrites — line-level batch collapsing.
const RENAMES: Array<{ from: string; to: string }> = [
  {
    from: "Elijah Craig Barrel Proof, Batch A125",
    to: "Elijah Craig Barrel Proof",
  },
  {
    from: "Bardstown Fusion Series #6",
    to: "Bardstown Fusion Series",
  },
  {
    from: "Maker's Mark Wood Finishing Series 2021 FAE-02",
    to: "Maker's Mark Wood Finishing Series 2021",
  },
];

const synonymIndex = buildSynonymIndex("bourbon");

function notesToVector(notes: string | null): WheelVector {
  const vector: WheelVector = {};
  if (!notes) return vector;
  for (const d of notes.split(/[,;/]/).map((s) => s.trim()).filter(Boolean)) {
    const leafId = matchChip(synonymIndex, d);
    if (leafId) vector[leafId] = Math.max(vector[leafId] ?? 0, 4);
  }
  return vector;
}

async function loadCobbNotesByName(xlsxPath: string): Promise<Map<string, string>> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const ws = wb.getWorksheet(SHEET_NAME);
  if (!ws) throw new Error(`Sheet "${SHEET_NAME}" not found in ${xlsxPath}`);

  const HEADERS = [
    "Shelf",
    "Distiller",
    "DSP",
    "Brand Name",
    "Expression / Detail",
    "Type",
    "Age",
    "Proof",
    "Additional Notes",
    "Mash Bill",
    "Tasting Notes",
    "ID Confidence",
    "Tier",
    "Style Family",
    "Tall?",
  ];

  const byName = new Map<string, string>();
  let isHeader = true;
  for (const row of ws.getRows(1, ws.rowCount) ?? []) {
    if (isHeader) {
      isHeader = false;
      continue;
    }
    const cells = (row.values as unknown[]).slice(1);
    const brand = String(cells[HEADERS.indexOf("Brand Name")] ?? "").trim();
    const expr = String(cells[HEADERS.indexOf("Expression / Detail")] ?? "").trim();
    if (!brand) continue;
    const name = expr ? `${brand} ${expr}` : brand;
    const notes = String(cells[HEADERS.indexOf("Tasting Notes")] ?? "").trim();
    byName.set(name, notes);
  }
  return byName;
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  const xlsxPath = process.argv.find((a) => a.endsWith(".xlsx")) ?? XLSX_DEFAULT_PATH;

  console.log(`[repair-after-dedupe] ${isDryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`[repair-after-dedupe] reading ${xlsxPath}`);

  const notesByName = await loadCobbNotesByName(xlsxPath);
  const supabase = adminClient();

  // ── Step 1: reset wheel_vector + remove wrong reviews on the 3 affected rows ──
  console.log("\n[repair-after-dedupe] resetting wheel_vector on 3 wrong-merge rows…");
  for (const name of WRONG_MERGE_NAMES) {
    const notes = notesByName.get(name);
    if (notes === undefined) {
      console.warn(`  ⚠ no Cobb xlsx row for "${name}" — skipping (might already be renamed)`);
      continue;
    }
    const vector = notesToVector(notes);
    const trait = rollUpTraits("bourbon", vector);

    const { data: row } = await supabase
      .from("products")
      .select("id")
      .eq("type", "bourbon")
      .eq("name", name)
      .maybeSingle();
    if (!row) {
      console.warn(`  ⚠ no DB row matching "${name}" — skipping`);
      continue;
    }

    console.log(`  • ${name}`);
    console.log(`      new wheel_vector: ${JSON.stringify(vector)}`);

    if (!isDryRun) {
      // Reset vector + trait to xlsx-only values.
      await supabase
        .from("products")
        .update({ wheel_vector: vector, trait_vector: trait })
        .eq("id", row.id);

      // Drop the wrongly-attached bourbonExplorer reviews.
      const { error } = await supabase
        .from("product_reviews")
        .delete()
        .eq("product_id", row.id)
        .eq("source", "bourbonExplorer");
      if (error) console.warn(`      review delete failed: ${error.message}`);
    }
  }

  // ── Step 2: rename line-level Cobb rows to drop batch identifiers ──
  console.log("\n[repair-after-dedupe] renaming line-level Cobb rows…");
  for (const { from, to } of RENAMES) {
    const { data: row } = await supabase
      .from("products")
      .select("id")
      .eq("type", "bourbon")
      .eq("name", from)
      .maybeSingle();
    if (!row) {
      console.warn(`  ⚠ no DB row matching "${from}" — skipping`);
      continue;
    }

    console.log(`  • "${from}"`);
    console.log(`      → "${to}"`);

    if (!isDryRun) {
      const { error } = await supabase
        .from("products")
        .update({ name: to })
        .eq("id", row.id);
      if (error) console.warn(`      rename failed: ${error.message}`);
    }
  }

  console.log("\n[repair-after-dedupe] done.");
  if (isDryRun) {
    console.log("[repair-after-dedupe] dry run — no changes made.");
  } else {
    console.log("\nNext steps:");
    console.log("  1. pnpm seed:bourbons   # re-inserts the 3 wrongly-deleted bex rows");
    console.log("                          # (tightened matcher now blocks the false positives)");
  }
}

main().catch((err) => {
  console.error("[repair-after-dedupe] failed:", err);
  process.exit(1);
});
