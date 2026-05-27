/**
 * Apply hand-edited catalog curation review back to Supabase.
 *
 *   pnpm apply:catalog-curation --dry-run ../../data/catalog-curation-export-2026-05-27.xlsx
 *   pnpm apply:catalog-curation --apply ../../data/your-edited-export.xlsx
 *   pnpm apply:catalog-curation --dry-run --tier=1,2
 *   pnpm apply:catalog-curation --apply --tier=1,2 ~/path/to/curation.xlsx
 *   pnpm apply:catalog-curation --apply data/catalog-curation-audit.xlsx
 *
 * Reads the "Curate" sheet. Updates brand, name, specs, vintages_matter, release_pattern.
 * products.name = REVIEW_canonical_name when set, else unchanged (proposed_* is export-only).
 * REVIEW_keep=N rows are deleted (same FK handling as remove-catalog-tier).
 * REVIEW_collapse is written to specs; run generate:collapse-map + collapse:catalog after.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { adminClient } from "./lib/supabase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VALID_RARITIES = new Set([
  "everyday",
  "seasonal",
  "allocated",
  "lottery",
  "secondary-only",
  "discontinued",
]);

type CurationRow = {
  product_id: string;
  sheet_tier: number | null;
  proposed_canonical_name: string | null;
  REVIEW_brand: string | null;
  REVIEW_expression: string | null;
  REVIEW_canonical_name: string | null;
  REVIEW_age: string | null;
  REVIEW_year_made: number | null;
  REVIEW_release_label: string | null;
  REVIEW_tier: number | null;
  REVIEW_distillery: string | null;
  REVIEW_whiskey_type: string | null;
  REVIEW_spirit_type: string | null;
  REVIEW_expression_type: string | null;
  REVIEW_rarity: string | null;
  REVIEW_vintages_matter: boolean;
  REVIEW_release_pattern: string | null;
  REVIEW_collapse: boolean;
  REVIEW_keep: boolean;
  REVIEW_notes: string | null;
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

function yn(v: unknown, defaultValue = false): boolean {
  const s = str(v)?.toUpperCase();
  if (s === "Y" || s === "YES" || s === "TRUE" || s === "1") return true;
  if (s === "N" || s === "NO" || s === "FALSE" || s === "0") return false;
  return defaultValue;
}

/** Spec keys the apply script may write — compare only these, not enrichment fields (proof, mash_bill, …). */
const CURATED_SPEC_KEYS = [
  "distillery",
  "whiskey_type",
  "expression_type",
  "spirit_type",
  "curated_expression",
  "age_label",
  "year_made",
  "tier",
  "tier_source",
  "availability_rarity",
  "curation_notes",
  "curation_release_label",
  "curation_collapse",
] as const;

function normReleasePattern(v: string | null | undefined): string | null {
  const s = v?.trim();
  return s || null;
}

function normSpecField(key: string, value: unknown): unknown {
  if (value === undefined || value === null || value === "") return undefined;
  if (key === "curation_collapse") {
    return value === true || value === "Y" ? "Y" : "N";
  }
  if (key === "year_made" || key === "tier") {
    const n = typeof value === "number" ? value : Number.parseFloat(String(value));
    return Number.isFinite(n) ? n : undefined;
  }
  return value;
}

/** Empty REVIEW cell on a curation sheet means remove this spec key (user cleared the yellow cell). */
function applyReviewSpec(
  specs: Record<string, unknown>,
  specKey: string,
  value: string | null,
  clearable: boolean,
) {
  if (value) {
    specs[specKey] = value;
  } else if (clearable) {
    delete specs[specKey];
  }
}

function curatedSpecsEqual(
  next: Record<string, unknown>,
  cur: Record<string, unknown> | null,
): boolean {
  const base = cur ?? {};
  for (const key of CURATED_SPEC_KEYS) {
    const a = normSpecField(key, next[key]);
    const b = normSpecField(key, base[key]);
    if (a === undefined && b === undefined) continue;
    if (JSON.stringify(a) !== JSON.stringify(b)) return false;
  }
  return true;
}

function parseCurateSheet(wb: ExcelJS.Workbook): CurationRow[] {
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
    const id = str(get(row, "product_id"));
    if (!id) continue;

    const rarity = str(get(row, "REVIEW_rarity"));
    if (rarity && !VALID_RARITIES.has(rarity)) {
      throw new Error(`Row ${r}: invalid REVIEW_rarity "${rarity}"`);
    }

    const reviewTier = tier(get(row, "REVIEW_tier"));
    const pattern = str(get(row, "REVIEW_release_pattern"));
    if (pattern && !["year", "batch", "pick"].includes(pattern)) {
      throw new Error(`Row ${r}: invalid REVIEW_release_pattern "${pattern}"`);
    }

    rows.push({
      product_id: id,
      sheet_tier: tier(get(row, "tier")),
      proposed_canonical_name: str(get(row, "proposed_canonical_name")),
      REVIEW_brand: str(get(row, "REVIEW_brand")),
      REVIEW_expression: str(get(row, "REVIEW_expression")),
      REVIEW_canonical_name: str(get(row, "REVIEW_canonical_name")),
      REVIEW_age: str(get(row, "REVIEW_age")),
      REVIEW_year_made: num(get(row, "REVIEW_year_made")),
      REVIEW_release_label: str(get(row, "REVIEW_release_label")),
      REVIEW_tier: reviewTier,
      REVIEW_distillery: str(get(row, "REVIEW_distillery")),
      REVIEW_whiskey_type: str(get(row, "REVIEW_whiskey_type")),
      REVIEW_spirit_type: str(get(row, "REVIEW_spirit_type")),
      REVIEW_expression_type: str(get(row, "REVIEW_expression_type")),
      REVIEW_rarity: rarity,
      REVIEW_vintages_matter: yn(get(row, "REVIEW_vintages_matter")),
      REVIEW_release_pattern: pattern,
      REVIEW_collapse: yn(get(row, "REVIEW_collapse")),
      REVIEW_keep: yn(get(row, "REVIEW_keep"), true),
      REVIEW_notes: str(get(row, "REVIEW_notes")),
    });
  }
  return rows;
}

function describePatchDiff(
  cur: { brand: string | null; name: string; specs: Record<string, unknown> | null; vintages_matter: boolean; release_pattern: string | null },
  patch: { brand: string | null; name: string; specs: Record<string, unknown>; vintages_matter: boolean; release_pattern: string | null },
): string {
  const parts: string[] = [];
  if (patch.brand !== cur.brand) parts.push("brand");
  if (patch.name !== cur.name) parts.push("name");
  if (patch.vintages_matter !== cur.vintages_matter) parts.push("vintages_matter");
  if (normReleasePattern(patch.release_pattern) !== normReleasePattern(cur.release_pattern)) {
    parts.push("release_pattern");
  }
  if (!curatedSpecsEqual(patch.specs, cur.specs)) parts.push("specs");
  return parts.join(", ") || "unknown";
}

function parseTierFilter(argv: string[]): Set<number> | null {
  const arg = argv.find((a) => a.startsWith("--tier="));
  if (!arg) return null;
  const tiers = arg
    .slice("--tier=".length)
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 5);
  if (!tiers.length) throw new Error(`Invalid --tier= value: ${arg}`);
  return new Set(tiers);
}

function filterByTier(rows: CurationRow[], tiers: Set<number> | null): CurationRow[] {
  if (!tiers) return rows;
  return rows.filter((r) => r.sheet_tier != null && tiers.has(r.sheet_tier));
}

async function deleteProduct(id: string) {
  const supa = adminClient();
  await supa.from("pairings_cache").delete().eq("bourbon_id", id);
  await supa.from("pairings_cache").delete().eq("cigar_id", id);
  const { error } = await supa.from("products").delete().eq("id", id);
  if (error) throw error;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;
  const tierFilter = parseTierFilter(process.argv);
  const xlsxArg = process.argv.find((a) => a.endsWith(".xlsx"));
  if (!xlsxArg) {
    console.error(
      "[apply-catalog-curation] Pass the spreadsheet you edited:\n" +
        "  pnpm apply:catalog-curation --dry-run ../../data/catalog-curation-export-YYYY-MM-DD.xlsx\n" +
        "  pnpm apply:catalog-curation --apply ../../data/your-edited-export.xlsx",
    );
    process.exit(1);
  }
  const xlsxPath = path.resolve(xlsxArg);

  console.log(`[apply-catalog-curation] ${dryRun ? "DRY RUN" : "APPLY"} ← ${xlsxPath}`);
  if (tierFilter) {
    console.log(`[apply-catalog-curation] tier filter: ${[...tierFilter].sort().join(", ")}`);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const allRows = parseCurateSheet(wb);
  const rows = filterByTier(allRows, tierFilter);
  console.log(`[apply-catalog-curation] rows in scope: ${rows.length} of ${allRows.length}`);

  const supa = adminClient();
  const ids = rows.map((r) => r.product_id);
  const existing = new Map<
    string,
    {
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

  const deletes = rows.filter((r) => !r.REVIEW_keep);
  const updates = rows.filter((r) => r.REVIEW_keep);
  const collapseRows = updates.filter((r) => r.REVIEW_collapse);

  let changed = 0;
  let skipMissing = 0;
  for (const row of updates) {
    const cur = existing.get(row.product_id);
    if (!cur) {
      skipMissing += 1;
      continue;
    }

    const specs = { ...(cur.specs ?? {}) };
    const setSpec = (key: string, value: unknown) => {
      if (value === null || value === undefined || value === "") return;
      specs[key] = value;
    };

    setSpec("distillery", row.REVIEW_distillery);
    applyReviewSpec(specs, "whiskey_type", row.REVIEW_whiskey_type, true);
    applyReviewSpec(specs, "expression_type", row.REVIEW_expression_type, true);
    applyReviewSpec(specs, "spirit_type", row.REVIEW_spirit_type, true);
    applyReviewSpec(specs, "curated_expression", row.REVIEW_expression, true);
    applyReviewSpec(specs, "age_label", row.REVIEW_age, true);
    if (row.REVIEW_year_made != null) setSpec("year_made", row.REVIEW_year_made);
    if (row.REVIEW_tier != null) {
      specs.tier = row.REVIEW_tier;
      specs.tier_source = "curation";
    }
    if (row.REVIEW_rarity) specs.availability_rarity = row.REVIEW_rarity;
    applyReviewSpec(specs, "curation_notes", row.REVIEW_notes, true);
    applyReviewSpec(specs, "curation_release_label", row.REVIEW_release_label, true);
    specs.curation_collapse = row.REVIEW_collapse ? "Y" : "N";

    const patch = {
      brand: row.REVIEW_brand ?? cur.brand,
      name: row.REVIEW_canonical_name ?? cur.name,
      specs,
      vintages_matter: row.REVIEW_vintages_matter,
      release_pattern: row.REVIEW_release_pattern,
    };

    const same =
      patch.brand === cur.brand &&
      patch.name === cur.name &&
      patch.vintages_matter === cur.vintages_matter &&
      normReleasePattern(patch.release_pattern) === normReleasePattern(cur.release_pattern) &&
      curatedSpecsEqual(specs, cur.specs);

    if (same) continue;

    changed += 1;
    const fields = describePatchDiff(cur, patch);
    console.log(
      `  UPDATE [${fields}] ${cur.name.slice(0, 36)} → ${patch.name.slice(0, 36)}`,
    );
    if (!dryRun) {
      const { error } = await supa.from("products").update(patch).eq("id", row.product_id);
      if (error) throw error;
    }
  }

  if (skipMissing > 0) {
    console.warn(
      `[apply-catalog-curation] ${skipMissing} rows skipped (product_id not in DB — collapsed/deleted or stale spreadsheet). Re-export: pnpm export:catalog-curation ../../data/catalog-curation-audit.xlsx --merge-from <your-edits.xlsx>`,
    );
  }

  console.log(
    `[apply-catalog-curation] updates=${changed} deletes=${deletes.length} collapse_flagged=${collapseRows.length} skip_missing=${skipMissing}`,
  );

  if (collapseRows.length) {
    console.log("[apply-catalog-curation] collapse candidates (build map separately):");
    for (const r of collapseRows.slice(0, 10)) {
      const cur = existing.get(r.product_id);
      console.log(
        `  ${r.product_id} ${cur?.name ?? "?"} → ${r.REVIEW_canonical_name} (${r.REVIEW_release_label ?? "no label"})`,
      );
    }
    if (collapseRows.length > 10) {
      console.log(`  … and ${collapseRows.length - 10} more`);
    }
  }

  if (deletes.length) {
    console.log("[apply-catalog-curation] deletes:");
    for (const r of deletes) {
      const cur = existing.get(r.product_id);
      console.log(`  DELETE ${r.product_id} ${cur?.name ?? "?"}`);
      if (!dryRun) await deleteProduct(r.product_id);
    }
  }

  if (dryRun) console.log("[apply-catalog-curation] Re-run with --apply to write.");
}

main().catch((err) => {
  console.error("[apply-catalog-curation] failed:", err);
  process.exit(1);
});
