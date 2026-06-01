/**
 * seed-catalog — the single owner of the member-facing bourbon catalog.
 *
 * `data/catalog/bourbon-shelf.csv` is the authored source of truth: one row per
 * shelf bottle. Open it in any spreadsheet, edit, save, then apply. This script
 * makes the DB match the sheet, deterministically:
 *
 *   - every sheet row     → catalog_included = true (+ identity fields synced)
 *   - every other bourbon  → catalog_included = false
 *
 * Editing model (no catalog UI needed):
 *   - add a bottle      → add a row, leave `id` blank (a new id is generated on
 *                         --apply and written back into the sheet)
 *   - drop from shelf   → delete the row (the product is hidden, not deleted)
 *   - rename / retag    → edit the cell
 *
 * Idempotent and order-independent. Run after backfill-catalog-spine (which only
 * writes grouping fields, never catalog_included). Images are intentionally NOT
 * managed here — they come from the app photo flow.
 *
 *   pnpm seed:catalog            # dry run
 *   pnpm seed:catalog --apply    # write (and backfill new ids into the CSV)
 */

import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { adminClient } from "./lib/supabase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV = path.resolve(__dirname, "../../../../data/catalog/bourbon-shelf.csv");
const APPLY = process.argv.includes("--apply");

const COLS = [
  "brand_family", "expression", "expression_type", "name", "is_core_range",
  "tier", "availability", "price_usd",
  "proof", "abv", "age", "mash", "spirit_type", "producer", "brand", "id",
] as const;
type Col = (typeof COLS)[number];

type ShelfRow = Record<Col, string>;

/** Curated availability axis — must match normalize-specs AVAILABILITY_RARITY. */
const AVAILABILITY_VALUES = new Set([
  "everyday", "seasonal", "allocated", "lottery", "secondary-only", "discontinued",
]);

function num(v: string): number | null {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

async function readSheet(): Promise<ShelfRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.csv.readFile(CSV);
  const ws = wb.worksheets[0];
  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (c, i) => {
    headers[i - 1] = String(c.value ?? "").trim();
  });
  const idx = (k: Col) => headers.indexOf(k);
  const rows: ShelfRow[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const get = (k: Col) => {
      const i = idx(k);
      const v = i >= 0 ? row.getCell(i + 1).value : null;
      const raw = v && typeof v === "object" && "result" in v ? (v as { result: unknown }).result : v;
      return raw == null ? "" : String(raw).trim();
    };
    const rec = Object.fromEntries(COLS.map((c) => [c, get(c)])) as ShelfRow;
    if (!rec.brand_family && !rec.expression && !rec.name) continue; // skip blank lines
    // Guardrail: the Unicode replacement char (U+FFFD) means the CSV was saved
    // in the wrong encoding (e.g. Excel non-UTF-8), which silently mangles
    // em-dashes and curly quotes. Refuse to write rather than corrupt the DB.
    for (const c of COLS) {
      if (rec[c]?.includes("�")) {
        throw new Error(
          `Encoding corruption (�) in row "${rec.name || rec.expression}" column "${c}". ` +
            "Re-save bourbon-shelf.csv as UTF-8 (Excel: 'CSV UTF-8') and try again. Nothing was written.",
        );
      }
    }
    rows.push(rec);
  }
  return rows;
}

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function writeSheet(rows: ShelfRow[]): void {
  const lines = [COLS.join(",")];
  for (const r of rows) lines.push(COLS.map((c) => csvEscape(r[c] ?? "")).join(","));
  writeFileSync(CSV, `${lines.join("\n")}\n`, "utf8");
}

function specsPatch(r: ShelfRow, existing: Record<string, unknown> | null): Record<string, unknown> {
  const specs = { ...(existing ?? {}) };
  if (num(r.proof) != null) specs.proof = num(r.proof);
  if (num(r.abv) != null) specs.abv = num(r.abv);
  if (num(r.age) != null) specs.age_years = num(r.age);
  if (r.mash) specs.mash_bill = r.mash;
  if (r.spirit_type) specs.spirit_type = r.spirit_type;
  // Release type (Single Barrel / Small Batch / Barrel Proof / …). Blank means
  // "standard flagship, no special type" — clear it so it doesn't linger.
  if (r.expression_type) specs.expression_type = r.expression_type;
  else delete specs.expression_type;

  // Catalog tier 1–5 — drives the member "Catalog Shelf" visibility filter and
  // the rarity label. Blank leaves it unset (always visible).
  const tier = num(r.tier);
  if (tier != null) {
    if (!Number.isInteger(tier) || tier < 1 || tier > 5) {
      throw new Error(`Bad tier "${r.tier}" for "${r.name}" — must be an integer 1–5.`);
    }
    specs.tier = tier;
    specs.tier_source = "curation";
  } else {
    delete specs.tier;
  }

  // Availability axis (everyday / seasonal / allocated / lottery /
  // secondary-only / discontinued). Blank clears it.
  const avail = r.availability.trim().toLowerCase();
  if (avail) {
    if (!AVAILABILITY_VALUES.has(avail)) {
      throw new Error(
        `Bad availability "${r.availability}" for "${r.name}" — use one of: ${[...AVAILABILITY_VALUES].join(", ")}.`,
      );
    }
    specs.availability_rarity = avail;
  } else {
    delete specs.availability_rarity;
  }

  // Dollar price → drives the $–$$$$ bucket (the bucket itself is derived, not
  // stored). Blank clears it.
  const price = num(r.price_usd);
  if (price != null) {
    if (price <= 0) throw new Error(`Bad price_usd "${r.price_usd}" for "${r.name}".`);
    specs.price_usd = price;
  } else {
    delete specs.price_usd;
  }
  return specs;
}

async function main() {
  const rows = await readSheet();
  const supa = adminClient();

  const { data: existing, error } = await supa
    .from("products")
    .select("id, specs, catalog_included")
    .eq("type", "bourbon");
  if (error) throw error;
  const byId = new Map((existing ?? []).map((r) => [r.id as string, r]));

  let generated = 0;
  for (const r of rows) {
    if (!r.id) {
      r.id = randomUUID();
      generated++;
    }
  }
  const shelfIds = new Set(rows.map((r) => r.id));
  const inserts = rows.filter((r) => !byId.has(r.id));
  const toHide = (existing ?? []).filter((r) => r.catalog_included && !shelfIds.has(r.id as string));

  console.log(`Sheet rows:        ${rows.length}`);
  console.log(`New (blank id):    ${generated}`);
  console.log(`Already in DB:     ${rows.length - inserts.length}`);
  console.log(`Will hide off-shelf: ${toHide.length}`);

  if (!APPLY) {
    console.log("\nDry run. Re-run with --apply to write.\n");
    return;
  }

  for (const r of rows) {
    const prior = byId.get(r.id);
    const patch: Record<string, unknown> = {
      id: r.id,
      type: "bourbon",
      name: r.name,
      brand: r.brand,
      brand_family: r.brand_family,
      expression: r.expression,
      producer: r.producer || null,
      is_core_range: /^y(es)?$/i.test(r.is_core_range),
      catalog_included: true,
      status: "confirmed",
      specs: specsPatch(r, (prior?.specs as Record<string, unknown> | null) ?? null),
    };
    if (!prior) patch.source = "manual";
    const { error: upErr } = await supa.from("products").upsert(patch, { onConflict: "id" });
    if (upErr) throw new Error(`upsert ${r.id} (${r.name}): ${upErr.message}`);
  }

  if (toHide.length) {
    const { error: hideErr } = await supa
      .from("products")
      .update({ catalog_included: false })
      .in("id", toHide.map((r) => r.id as string));
    if (hideErr) throw new Error(`hide: ${hideErr.message}`);
  }

  if (generated > 0) {
    writeSheet(rows);
    console.log(`Wrote ${generated} new id(s) back into ${path.basename(CSV)}.`);
  }
  console.log(`\nDone. Catalog = ${rows.length} bourbons; ${toHide.length} hidden off-shelf.\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
