/**
 * Restore Colonel E.H. Taylor expressions after bad collapse merge.
 *
 *   pnpm restore:taylor --dry-run
 *   pnpm restore:taylor --apply
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { KNOWN_RELEASE_LABELS_KEY } from "@/lib/tasting/known-release-labels";
import {
  buildRestoreSpecs,
  displayName,
  knownReleaseLabels,
  parseCurateRows,
} from "./lib/curation-restore";
import { adminClient } from "./lib/supabase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_XLSX = path.resolve(
  __dirname,
  "../../../../data/catalog-curation-review.xlsx",
);

const SEASONED_WOOD_ID = "19b94e8b-6673-4c77-97b8-0863134122b7";

function isTaylor(row: { brand: string; name: string }): boolean {
  return /taylor/i.test(`${row.brand} ${row.name}`);
}

async function loadTaylorRows(xlsxPath: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const ws = wb.getWorksheet("Curate");
  if (!ws) throw new Error('Missing "Curate" sheet');
  return parseCurateRows(ws, isTaylor);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;
  const xlsxPath = process.argv.find((a) => a.endsWith(".xlsx"))
    ? path.resolve(process.argv.find((a) => a.endsWith(".xlsx"))!)
    : DEFAULT_XLSX;

  console.log(`[restore-taylor] ${dryRun ? "DRY RUN" : "APPLY"} ← ${xlsxPath}`);
  const rows = await loadTaylorRows(xlsxPath);
  const supa = adminClient();

  let inserted = 0;
  let updated = 0;

  for (const row of rows.values()) {
    const patch = {
      id: row.product_id,
      type: "bourbon" as const,
      name: displayName(row),
      brand: row.review_brand ?? row.brand,
      specs: {
        ...buildRestoreSpecs(row),
        [KNOWN_RELEASE_LABELS_KEY]: knownReleaseLabels(row),
      },
      status: "confirmed" as const,
      source: "seed" as const,
      vintages_matter: false,
      release_pattern:
        (row.review_release_pattern as "year" | "batch" | "pick" | null) ?? null,
    };

    const { data: existing } = await supa
      .from("products")
      .select("id,name")
      .eq("id", row.product_id)
      .maybeSingle();

    if (existing) {
      const action =
        existing.id === SEASONED_WOOD_ID && existing.name !== patch.name
          ? "FIX"
          : "UPDATE";
      console.log(`  ${action} ${existing.name} → ${patch.name}`);
      if (!dryRun) {
        const { error } = await supa.from("products").update(patch).eq("id", row.product_id);
        if (error) throw error;
      }
      updated += 1;
      continue;
    }

    console.log(`  INSERT ${patch.name}`);
    if (!dryRun) {
      const { error } = await supa.from("products").insert(patch);
      if (error) throw error;
    }
    inserted += 1;
  }

  console.log(`[restore-taylor] inserted=${inserted} updated=${updated}`);
  if (dryRun) console.log("[restore-taylor] Re-run with --apply to write.");
}

main().catch((err) => {
  console.error("[restore-taylor] failed:", err);
  process.exit(1);
});
