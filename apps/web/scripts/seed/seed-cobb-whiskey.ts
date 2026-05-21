/**
 * Seed (or enrich) the bourbon catalog from Paul's personal whiskey
 * collection xlsx. These are bottles he actually owns — way more relevant
 * to NCCC tastings than generic catalog data.
 *
 * Usage:
 *   pnpm seed:cobb-whiskey
 *   pnpm seed:cobb-whiskey ~/Downloads/Cobb_Whiskey_Collection_Updated.xlsx
 *
 * Default path: scripts/seed/data/private/cobb-whiskey.xlsx (gitignored).
 *
 * Behavior:
 * - Reads the "Whiskey Collection" sheet only (skips Summary + Shelf Plan).
 * - For each row, builds a product with type='bourbon' (rye and other
 *   whiskies live under the same type — the bourbon wheel still applies).
 * - Idempotent on (type, brand, name). Existing rows from bourbonExplorer
 *   get their specs merged with Paul's data (mash bill from the bottle
 *   wins over generic dataset's).
 * - Maps Tasting Notes onto the bourbon wheel via the synonym index;
 *   adds wheel_vector + trait_vector for entries that have any.
 * - Stamps every product with specs.in_cobb_collection=true so we can
 *   filter "Paul's Shelf" later without joining auxiliary tables.
 * - ID Confidence != HIGH ⇒ status='draft' (LOW/MED stay editable until
 *   confirmed via the in-app product edit screen).
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
const DEFAULT_PATH = path.join(__dirname, "data", "private", "cobb-whiskey.xlsx");
const SHEET_NAME = "Whiskey Collection";
const WHEEL_VERSION = "0.1";

const synonymIndex = buildSynonymIndex("bourbon");

type ParsedRow = {
  shelf: string | null;
  distillery: string | null;
  dsp: string | null;
  brand: string | null;
  expression: string | null;
  whiskey_type: string | null;
  age: string | null;
  proof: number | null;
  additional_notes: string | null;
  mash_bill: string | null;
  tasting_notes_raw: string | null;
  id_confidence: "HIGH" | "MED" | "LOW" | null;
  tier: number | null;
  style_family: string | null;
  tall: boolean;
};

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

function parseRow(values: unknown[]): ParsedRow | null {
  // ExcelJS row.values is 1-indexed with a null at [0]. Drop the leading null
  // so columns line up with HEADERS by index.
  const cells = values.slice(1);
  const get = (col: string) => {
    const idx = HEADERS.indexOf(col);
    if (idx === -1) return null;
    return cells[idx] ?? null;
  };

  const brand = str(get("Brand Name"));
  if (!brand) return null;

  const idConf = str(get("ID Confidence"))?.toUpperCase();
  const confidence: "HIGH" | "MED" | "LOW" | null =
    idConf === "HIGH" || idConf === "MED" || idConf === "LOW" ? idConf : null;

  return {
    shelf: str(get("Shelf")),
    distillery: str(get("Distiller")),
    dsp: str(get("DSP")),
    brand,
    expression: str(get("Expression / Detail")),
    whiskey_type: str(get("Type")),
    age: str(get("Age")),
    proof: num(get("Proof")),
    additional_notes: str(get("Additional Notes")),
    mash_bill: str(get("Mash Bill")),
    tasting_notes_raw: str(get("Tasting Notes")),
    id_confidence: confidence,
    tier: num(get("Tier")),
    style_family: str(get("Style Family")),
    tall: Boolean(get("Tall?")),
  };
}

function rowToProductName(row: ParsedRow): string {
  if (row.expression && row.expression.trim()) {
    return `${row.brand} ${row.expression}`.trim();
  }
  return row.brand!;
}

function ageInYears(age: string | null): number | null {
  if (!age) return null;
  if (/NAS/i.test(age)) return null;
  const m = age.match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

function notesToVector(notes: string | null): {
  vector: WheelVector;
  unmapped: string[];
} {
  const vector: WheelVector = {};
  const unmapped: string[] = [];
  if (!notes) return { vector, unmapped };
  const descriptors = notes.split(/[,;/]/).map((d) => d.trim()).filter(Boolean);
  for (const d of descriptors) {
    const leafId = matchChip(synonymIndex, d);
    if (leafId) vector[leafId] = Math.max(vector[leafId] ?? 0, 4);
    else unmapped.push(d);
  }
  return { vector, unmapped };
}

async function main() {
  const xlsxPath = process.argv[2] || DEFAULT_PATH;
  console.log(`[cobb-whiskey] reading ${xlsxPath}`);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const ws = wb.getWorksheet(SHEET_NAME);
  if (!ws) throw new Error(`Sheet "${SHEET_NAME}" not found in ${xlsxPath}`);

  const supabase = adminClient();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const unmappedTally = new Map<string, number>();

  // Row 1 is the header — start at row 2.
  let isHeader = true;
  for (const row of ws.getRows(1, ws.rowCount) ?? []) {
    const rawValues = row.values as unknown[];
    if (isHeader) {
      isHeader = false;
      continue;
    }

    const parsed = parseRow(rawValues);
    if (!parsed) {
      skipped += 1;
      continue;
    }

    const result = await upsertWhiskey(supabase, parsed, unmappedTally);
    if (result === "inserted") inserted += 1;
    else if (result === "updated") updated += 1;
    else skipped += 1;
  }

  console.log(`[cobb-whiskey] done. inserted=${inserted} updated=${updated} skipped=${skipped}`);

  if (unmappedTally.size > 0) {
    console.log("\n[cobb-whiskey] unmapped tasting-note terms:");
    const sorted = [...unmappedTally.entries()].sort((a, b) => b[1] - a[1]);
    for (const [term, count] of sorted) {
      console.log(`  ${String(count).padStart(3)}  ${term}`);
    }
  }
}

async function upsertWhiskey(
  supabase: ReturnType<typeof adminClient>,
  row: ParsedRow,
  unmappedTally: Map<string, number>,
): Promise<"inserted" | "updated" | "skipped"> {
  const name = rowToProductName(row);
  const brand = row.brand;
  const { vector: wheelVector, unmapped } = notesToVector(row.tasting_notes_raw);
  for (const u of unmapped) unmappedTally.set(u, (unmappedTally.get(u) ?? 0) + 1);

  const traitVector = rollUpTraits("bourbon", wheelVector);

  const specs = {
    distillery: row.distillery,
    dsp: row.dsp,
    proof: row.proof,
    age_years: ageInYears(row.age),
    age_label: row.age,
    mash_bill: row.mash_bill,
    additional_notes: row.additional_notes,
    whiskey_type: row.whiskey_type,
    style_family: row.style_family,
    tier: row.tier,
    tall: row.tall,
    shelf: row.shelf,
    tasting_notes_raw: row.tasting_notes_raw,
    in_cobb_collection: true,
  };

  const status = row.id_confidence === "HIGH" ? "confirmed" : "draft";

  const { data: existing } = await supabase
    .from("products")
    .select("id, specs, wheel_vector")
    .eq("type", "bourbon")
    .eq("name", name)
    .eq("brand", brand ?? "")
    .maybeSingle();

  if (existing) {
    // Merge specs (Paul's data overrides on overlapping keys), keep the
    // richer wheel_vector if existing had more leaves than this row's notes.
    const mergedSpecs = {
      ...((existing.specs as Record<string, unknown>) ?? {}),
      ...specs,
    };
    const existingVec = (existing.wheel_vector as WheelVector | null) ?? {};
    const mergedVec: WheelVector = { ...existingVec };
    for (const [leafId, score] of Object.entries(wheelVector)) {
      mergedVec[leafId] = Math.max(mergedVec[leafId] ?? 0, score);
    }
    const mergedTraits = rollUpTraits("bourbon", mergedVec);

    const { error } = await supabase
      .from("products")
      .update({
        specs: mergedSpecs,
        wheel_vector: mergedVec,
        trait_vector: mergedTraits,
        // Don't downgrade a confirmed catalog row back to draft.
        ...(status === "confirmed" ? { status: "confirmed" } : {}),
      })
      .eq("id", existing.id);
    if (error) {
      console.warn(`[cobb-whiskey] update failed for "${name}":`, error.message);
      return "skipped";
    }
    return "updated";
  }

  const { error } = await supabase.from("products").insert({
    type: "bourbon",
    name,
    brand,
    specs,
    wheel_version: WHEEL_VERSION,
    wheel_vector: wheelVector,
    trait_vector: traitVector,
    status,
    source: "seed",
  });
  if (error) {
    console.warn(`[cobb-whiskey] insert failed for "${name}":`, error.message);
    return "skipped";
  }
  return "inserted";
}

function str(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number") return String(v);
  return null;
}
function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.\-]/g, "").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

main().catch((err) => {
  console.error("[cobb-whiskey] failed:", err);
  process.exit(1);
});
