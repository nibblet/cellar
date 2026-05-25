/**
 * Phase 1 of catalog curation: strip release/age/boilerplate noise from product names
 * so collapse proposals (phase 2) group on bar-order identity.
 *
 * Release detail → release_label on tastings. Age → specs.age_label.
 */

import type { NormalizationInput, ReleasePattern } from "./expression-normalize";
import {
  extractBarrellBatchLabel,
  extractBatchNumber,
  extractReleaseYear,
  formatBrandExpression,
} from "./expression-normalize";

export type CatalogNameCleanup = {
  /** Human-readable catalog name — no years, batches, barrel #s, or age clutter. */
  displayName: string;
  ageLabel: string | null;
  releaseLabel: string | null;
  releasePattern: ReleasePattern | null;
};

const BOILERPLATE =
  /\s*,?\s*(?:Kentucky|Tennessee)\s+Straight(?:\s+Bourbon|\s+Whiskey|\s+Rye)?\b/gi;
const AGE_PHRASE = /\b(\d{1,2}(?:\.\d+)?)\s*(?:year|yr|years)\s*old\b/gi;
const AGE_TRAILING = /\b(\d{1,2}(?:\.\d+)?)\s*(?:yr|year|years)\b/gi;
const PROOF_NOISE = /\s*\(?\s*\d+(?:\.\d+)?\s*%\s*(?:abv|alc\.?\/?vol\.?)?\s*\)?/gi;
const BLEND_NOISE = /\s*,?\s*blend of straights?(?:\s+bourbons?)?\b/gi;
const RELEASE_PAREN =
  /\(\s*(?:bottled\s+)?((?:20|19)\d{2})\s*(?:release|edition|vintage)?\s*\)/gi;
const BATCH_PAREN = /\(\s*(?:batch\s*)?(?:no\.?\s*)?#?\s*([\w.]+)\s*\)/gi;
const BARREL_PAREN = /\(\s*barrel\s*(?:#|no\.?)\s*([\w.]+)\s*\)/gi;

function specStr(specs: Record<string, unknown> | null, key: string): string | null {
  const v = specs?.[key];
  if (v === null || v === undefined || v === "") return null;
  return String(v).trim() || null;
}

function specNum(specs: Record<string, unknown> | null, key: string): number | null {
  const v = specs?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function normalizeSpaces(name: string): string {
  return name.replace(/\s+/g, " ").replace(/\s+([,.])/g, "$1").trim();
}

function stripBrandPrefix(brand: string | null, name: string): string {
  if (!brand) return name;
  const re = new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i");
  return name.replace(re, "").trim();
}

function extractAgeLabel(name: string, specs: Record<string, unknown> | null): string | null {
  const fromSpec = specStr(specs, "age_label");
  if (fromSpec) return fromSpec;

  const ageOld = name.match(/\b(\d{1,2}(?:\.\d+)?)\s*(?:year|yr|years)\s*old\b/i);
  if (ageOld) return `${ageOld[1]} yr`;

  const nas = name.match(/\bNAS\b/i);
  if (nas) return "NAS";

  return null;
}

function extractReleaseMeta(
  name: string,
  specs: Record<string, unknown> | null,
): { label: string | null; pattern: ReleasePattern | null } {
  const yearMade = specNum(specs, "year_made");

  const batch =
    extractBarrellBatchLabel(name) ??
    (() => {
      const m = name.match(/\(\s*batch\s*([\w.]+)\s*\)/i);
      if (m) return `Batch ${m[1]}`;
      const inline = name.match(/\bbatch\s*(?:no\.?\s*)?([\w.]+)\b/i);
      if (inline) return `Batch ${inline[1]}`;
      return extractBatchNumber(name);
    })();
  if (batch) return { label: batch, pattern: "batch" };

  const pick = name.match(/barrel\s*(?:#|no\.?)\s*([\w.]+)/i);
  if (pick) return { label: `Barrel ${pick[1]}`, pattern: "pick" };

  const year = extractReleaseYear(name, yearMade);
  if (year) return { label: year, pattern: "year" };

  return { label: null, pattern: null };
}

/** Remove extracted release/age/boilerplate tokens from a working name string. */
function stripNoiseFromName(name: string): string {
  let s = name;
  s = s.replace(RELEASE_PAREN, "");
  s = s.replace(BATCH_PAREN, "");
  s = s.replace(BARREL_PAREN, "");
  s = s.replace(AGE_PHRASE, "");
  s = s.replace(AGE_TRAILING, "");
  s = s.replace(PROOF_NOISE, "");
  s = s.replace(BLEND_NOISE, "");
  s = s.replace(BOILERPLATE, "");
  s = s.replace(/\(\s*(20|19)\d{2}\s*(?:release|edition|vintage)?\s*\)/gi, "");
  s = s.replace(/\b(20|19)\d{2}\s*(?:release|edition|vintage)\b/gi, "");
  s = s.replace(/\(\s*no\.?\s*[\d.]+\s*\)/gi, "");
  if (!/^old no\.?\s*\d/i.test(name)) {
    s = s.replace(/\s*(?:#\s*\d+|no\.?\s*[\d.]+)\s*$/i, "");
  }
  s = s.replace(/\s*—\s*\d+\s*year\s*$/i, "");
  s = s.replace(/,\s*$/, "");
  return normalizeSpaces(s);
}

function needsBrandPrefix(brand: string | null, cleaned: string): boolean {
  if (!brand || !cleaned) return false;
  const b = brand.toLowerCase();
  const c = cleaned.toLowerCase();
  if (c.startsWith(b)) return false;
  // Name is only a number, age token, or very short fragment
  if (/^(\d+|nas|\d+\s*yr)$/i.test(cleaned)) return true;
  if (cleaned.length <= 12 && !c.includes(b.split(" ")[0] ?? "")) return true;
  return false;
}

/**
 * Produce a clean bar-order display name and extracted metadata from a raw catalog row.
 */
export function cleanCatalogDisplayName(input: NormalizationInput): CatalogNameCleanup {
  const ageLabel = extractAgeLabel(input.name, input.specs);
  const { label: releaseLabel, pattern: releasePattern } = extractReleaseMeta(
    input.name,
    input.specs,
  );

  let core = stripNoiseFromName(input.name);

  if (/^straight$/i.test(core) && input.brand) {
    core = input.brand;
  } else if (
    input.brand &&
    !core.toLowerCase().startsWith(input.brand.toLowerCase()) &&
    (/^\d{4}$/.test(core) || /^old no\.?\s*\d/i.test(core) || needsBrandPrefix(input.brand, core))
  ) {
    core = formatBrandExpression(input.brand, core);
  }

  return {
    displayName: core || input.name,
    ageLabel,
    releaseLabel,
    releasePattern,
  };
}

/** Run normalization against a name-cleaned view of the row. */
export function withCleanedName(input: NormalizationInput): NormalizationInput & {
  cleanup: CatalogNameCleanup;
} {
  const cleanup = cleanCatalogDisplayName(input);
  return {
    ...input,
    name: cleanup.displayName,
    cleanup,
  };
}
