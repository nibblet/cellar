import type ExcelJS from "exceljs";
import { normalizeExpressionType } from "@/lib/catalog/normalize-expression-type";

export type CurationRestoreRow = {
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
  review_brand: string | null;
  review_expression: string | null;
  review_expression_type: string | null;
  review_distillery: string | null;
  review_whiskey_type: string | null;
  review_release_label: string | null;
  review_release_pattern: "year" | "batch" | "pick" | null;
  review_collapse: boolean;
  proposed_collapse: boolean;
  review_keep: boolean;
  review_tier: number | null;
  review_rarity: string | null;
  review_spirit_type: string | null;
  review_vintages_matter: boolean;
  review_notes: string | null;
  review_age: string | null;
  proposed_canonical_name: string | null;
};

const PRESERVE_SPEC_KEYS = [
  "wheel_vector",
  "wheel_version",
  "image_url",
  "embedding",
  "enrichment_status",
  "enrichment_pending",
] as const;

export function cellValue(raw: ExcelJS.CellValue): unknown {
  if (raw && typeof raw === "object" && "result" in raw) {
    return (raw as { result: unknown }).result;
  }
  return raw;
}

export function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s || null;
}

export function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function tier(v: unknown): number | null {
  const n = num(v);
  if (n == null || !Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

export function yn(v: unknown, defaultValue = false): boolean {
  const s = str(v)?.toUpperCase();
  if (s === "Y" || s === "YES" || s === "TRUE" || s === "1") return true;
  if (s === "N" || s === "NO" || s === "FALSE" || s === "0") return false;
  return defaultValue;
}

/** Bar-order display name — prefer per-row proposed name over shared REVIEW_canonical_name. */
export function displayName(row: CurationRestoreRow): string {
  return row.proposed_canonical_name ?? row.name;
}

export function rawExpressionType(row: CurationRestoreRow): string | null {
  return row.review_expression_type ?? row.expression_type;
}

export function buildRestoreSpecs(row: CurationRestoreRow): Record<string, unknown> {
  const normalized = normalizeExpressionType(rawExpressionType(row));

  const specs: Record<string, unknown> = {
    // REVIEW_collapse was bulk-flipped to Y; proposed_collapse is the reliable flag.
    curation_collapse: row.proposed_collapse ? "Y" : "N",
  };
  if (row.review_distillery ?? row.distillery) {
    specs.distillery = row.review_distillery ?? row.distillery;
  }
  if (row.review_whiskey_type ?? row.whiskey_type) {
    specs.whiskey_type = row.review_whiskey_type ?? row.whiskey_type;
  }
  if (row.review_spirit_type) specs.spirit_type = row.review_spirit_type;
  if (normalized.expression_type) specs.expression_type = normalized.expression_type;
  if (normalized.expression_modifier) specs.expression_modifier = normalized.expression_modifier;
  if (row.review_expression) specs.curated_expression = row.review_expression;
  else if (normalized.expression_modifier) specs.curated_expression = normalized.expression_modifier;
  const age = row.review_age ?? row.age;
  if (age) specs.age_label = age;
  const yearMade = row.year_made;
  if (yearMade != null) specs.year_made = yearMade;
  const reviewTier = row.review_tier ?? row.tier;
  if (reviewTier != null) {
    specs.tier = reviewTier;
    specs.tier_source = "curation";
  }
  const rarity = row.review_rarity ?? row.rarity;
  if (rarity) specs.availability_rarity = rarity;
  if (row.review_release_label) specs.curation_release_label = row.review_release_label;
  if (row.review_notes) specs.curation_notes = row.review_notes;
  if (row.proof != null) {
    specs.proof = row.proof;
    specs.abv = row.proof / 2;
  }
  return specs;
}

export function mergePreserveSpecs(
  existing: Record<string, unknown> | null | undefined,
  restored: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...restored };
  for (const key of PRESERVE_SPEC_KEYS) {
    if (existing?.[key] != null) merged[key] = existing[key];
  }
  return merged;
}

export function knownReleaseLabels(row: CurationRestoreRow): string[] {
  if (row.review_release_label) return [row.review_release_label];
  if (row.year_made != null && row.review_expression) return [String(row.year_made)];
  return [];
}

function parseRow(
  row: ExcelJS.Row,
  get: (row: ExcelJS.Row, key: string) => unknown,
): CurationRestoreRow | null {
  const product_id = str(get(row, "product_id"));
  if (!product_id) return null;

  const pattern = str(get(row, "REVIEW_release_pattern"));
  const reviewReleasePattern =
    pattern === "year" || pattern === "batch" || pattern === "pick" ? pattern : null;

  return {
    product_id,
    brand: str(get(row, "brand")) ?? "",
    name: str(get(row, "name")) ?? "",
    tier: tier(get(row, "tier")),
    distillery: str(get(row, "distillery")),
    age: str(get(row, "age")),
    year_made: num(get(row, "year_made")),
    whiskey_type: str(get(row, "whiskey_type")),
    expression_type: str(get(row, "expression_type")),
    rarity: str(get(row, "rarity")),
    proof: num(get(row, "proof")),
    review_brand: str(get(row, "REVIEW_brand")),
    review_expression: str(get(row, "REVIEW_expression")),
    review_expression_type: str(get(row, "REVIEW_expression_type")),
    review_distillery: str(get(row, "REVIEW_distillery")),
    review_whiskey_type: str(get(row, "REVIEW_whiskey_type")),
    review_release_label: str(get(row, "REVIEW_release_label")),
    review_release_pattern: reviewReleasePattern,
    review_collapse: yn(get(row, "REVIEW_collapse")),
    proposed_collapse: yn(get(row, "proposed_collapse")),
    review_keep: yn(get(row, "REVIEW_keep"), true),
    review_tier: tier(get(row, "REVIEW_tier")),
    review_rarity: str(get(row, "REVIEW_rarity")),
    review_spirit_type: str(get(row, "REVIEW_spirit_type")),
    review_vintages_matter: yn(get(row, "REVIEW_vintages_matter")),
    review_notes: str(get(row, "REVIEW_notes")),
    review_age: str(get(row, "REVIEW_age")),
    proposed_canonical_name: str(get(row, "proposed_canonical_name")),
  };
}

export function parseCurateRows(
  ws: ExcelJS.Worksheet,
  filter: (row: CurationRestoreRow) => boolean = () => true,
): Map<string, CurationRestoreRow> {
  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = String(cell.value ?? "");
  });
  const get = (row: ExcelJS.Row, key: string) => {
    const i = headers.indexOf(key);
    return i >= 0 ? cellValue(row.getCell(i + 1).value) : null;
  };

  const byId = new Map<string, CurationRestoreRow>();
  for (let r = 2; r <= ws.rowCount; r++) {
    const parsed = parseRow(ws.getRow(r), get);
    if (!parsed || !filter(parsed)) continue;
    byId.set(parsed.product_id, parsed);
  }
  return byId;
}

export type RectifyProductPatch = {
  id: string;
  type: "bourbon";
  name: string;
  brand: string;
  specs: Record<string, unknown>;
  status: "confirmed";
  source?: "seed";
  vintages_matter: boolean;
  release_pattern: "year" | "batch" | "pick" | null;
};

export function buildRectifyPatch(
  row: CurationRestoreRow,
  existing: { specs: Record<string, unknown> | null } | null | undefined,
  knownReleaseLabelsKey: string,
): RectifyProductPatch {
  const restoredSpecs = buildRestoreSpecs(row);
  const specs = mergePreserveSpecs(existing?.specs, restoredSpecs);
  specs[knownReleaseLabelsKey] = knownReleaseLabels(row);

  return {
    id: row.product_id,
    type: "bourbon",
    name: displayName(row),
    brand: row.review_brand ?? row.brand,
    specs,
    status: "confirmed",
    source: existing ? undefined : "seed",
    vintages_matter: row.review_vintages_matter,
    release_pattern: row.review_release_pattern,
  };
}
