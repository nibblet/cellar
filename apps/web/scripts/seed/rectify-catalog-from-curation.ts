/**
 * Bulk rectification from catalog-curation-review.xlsx:
 * restore missing keep=Y products, sync collapse flags, normalize expression_type.
 *
 *   pnpm rectify:catalog --dry-run
 *   pnpm rectify:catalog --apply
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { KNOWN_RELEASE_LABELS_KEY } from "@/lib/tasting/known-release-labels";
import {
  buildRectifyPatch,
  parseCurateRows,
  rawExpressionType,
} from "./lib/curation-restore";
import { adminClient } from "./lib/supabase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_XLSX = path.resolve(
  __dirname,
  "../../../../data/catalog-curation-review.xlsx",
);

async function deleteProduct(id: string) {
  const supa = adminClient();
  await supa.from("pairings_cache").delete().eq("bourbon_id", id);
  await supa.from("pairings_cache").delete().eq("cigar_id", id);
  const { error } = await supa.from("products").delete().eq("id", id);
  if (error) throw error;
}

async function loadRows(xlsxPath: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const ws = wb.getWorksheet("Curate");
  if (!ws) throw new Error('Missing "Curate" sheet');
  return parseCurateRows(ws);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;
  const xlsxPath = process.argv.find((a) => a.endsWith(".xlsx"))
    ? path.resolve(process.argv.find((a) => a.endsWith(".xlsx"))!)
    : DEFAULT_XLSX;

  console.log(`[rectify:catalog] ${dryRun ? "DRY RUN" : "APPLY"} ← ${xlsxPath}`);
  const rows = await loadRows(xlsxPath);
  const keepRows = [...rows.values()].filter((r) => r.review_keep);
  const deleteRows = [...rows.values()].filter((r) => !r.review_keep);

  const supa = adminClient();
  const ids = [...rows.keys()];
  const existing = new Map<
    string,
    {
      id: string;
      brand: string | null;
      name: string;
      specs: Record<string, unknown> | null;
      vintages_matter: boolean;
      release_pattern: string | null;
    }
  >();

  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { data, error } = await supa
      .from("products")
      .select("id, brand, name, specs, vintages_matter, release_pattern")
      .in("id", chunk);
    if (error) throw error;
    for (const p of data ?? []) existing.set(p.id, p);
  }

  let inserted = 0;
  let updated = 0;
  let collapseFixed = 0;
  let expressionNormalized = 0;

  for (const row of keepRows) {
    const cur = existing.get(row.product_id);
    const patch = buildRectifyPatch(row, cur, KNOWN_RELEASE_LABELS_KEY);

    const raw = rawExpressionType(row);
    if (raw?.includes(",")) expressionNormalized += 1;

    const curCollapse = cur?.specs?.curation_collapse;
    const wantCollapse = row.proposed_collapse ? "Y" : "N";
    if (cur && curCollapse !== wantCollapse) collapseFixed += 1;

    if (cur) {
      const same =
        patch.brand === cur.brand &&
        patch.name === cur.name &&
        patch.vintages_matter === cur.vintages_matter &&
        patch.release_pattern === cur.release_pattern &&
        JSON.stringify(patch.specs) === JSON.stringify(cur.specs ?? {});

      if (same) continue;

      console.log(`  UPDATE ${cur.name.slice(0, 50)} → ${patch.name.slice(0, 50)}`);
      if (!dryRun) {
        const { source: _source, ...updatePatch } = patch;
        const { error } = await supa.from("products").update(updatePatch).eq("id", row.product_id);
        if (error) throw error;
      }
      updated += 1;
      continue;
    }

    console.log(`  INSERT ${patch.name}`);
    if (!dryRun) {
      const insertPatch = { ...patch, source: "seed" as const };
      const { error } = await supa.from("products").insert(insertPatch);
      if (error) throw error;
    }
    inserted += 1;
  }

  let deleted = 0;
  for (const row of deleteRows) {
    const cur = existing.get(row.product_id);
    if (!cur) continue;
    console.log(`  DELETE ${cur.name}`);
    if (!dryRun) await deleteProduct(row.product_id);
    deleted += 1;
  }

  const collapseCandidates = keepRows.filter((r) => r.proposed_collapse);
  console.log(
    `[rectify:catalog] keep=${keepRows.length} inserted=${inserted} updated=${updated} deleted=${deleted}`,
  );
  console.log(
    `[rectify:catalog] collapse_flag_synced=${collapseFixed} expression_type_normalized=${expressionNormalized}`,
  );
  console.log(`[rectify:catalog] collapse_candidates=${collapseCandidates.length} (regenerate map next)`);

  if (dryRun) console.log("[rectify:catalog] Re-run with --apply to write.");
}

main().catch((err) => {
  console.error("[rectify:catalog] failed:", err);
  process.exit(1);
});
