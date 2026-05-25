/**
 * Propose canonical expression names + release labels for catalog collapse review.
 * Used by export-catalog-normalization and generate-collapse-map.
 *
 * Rules: planning/catalog-expression-collapse.md § Brand + expression rules
 */

import {
  formatLineBrandCanonical,
  resolveLineBrand,
  type NormalizationContext,
} from "./line-brand";
import { cleanCatalogDisplayName } from "./catalog-name-cleanup";

export { buildNormalizationContext, type NormalizationContext } from "./line-brand";

export type ReleasePattern = "year" | "batch" | "pick";

export type ExpressionKind = "identity" | "series";

export type SpiritType = "bourbon" | "rye";

export type NormalizationInput = {
  id: string;
  name: string;
  brand: string | null;
  specs: Record<string, unknown> | null;
};

export type NormalizationProposal = {
  canonical_name: string;
  canonical_brand: string | null;
  expression_label: string | null;
  spirit_type: SpiritType | null;
  release_label: string | null;
  release_pattern: ReleasePattern | null;
  vintages_matter: boolean;
  collapse: boolean;
  is_survivor: boolean;
  skip_reason: string | null;
  age_in_name: string | null;
  never_collapse_line: boolean;
  blocked_by_expression_type: boolean;
};

const NEVER_COLLAPSE = [
  /george t\.?\s*stagg/i,
  /orphan barrel/i,
  /old fitzgerald/i,
];

const AGE_IN_NAME = /\b(\d{1,2})\s*(?:year|yr|years)\b/i;

/** expression_type tokens that identify a collapsible series line */
const SERIES_EXPRESSION_TOKENS = [
  "cask strength",
  "single barrel",
  "full proof",
  "small batch",
  "straight bourbon",
];

/** Canonical names that group tastings by release year on the product page. */
/** @deprecated All expressions use tasting chips; product pages do not group by year. */
const VINTAGES_MATTER_PATTERNS: Array<{ match: RegExp; pattern: ReleasePattern }> = [];

/** Legacy series rules — fixed canonical names (Bardstown, Four Roses). */
const SERIES_CANONICAL: Array<{
  match: (p: NormalizationInput) => boolean;
  canonical: string | ((p: NormalizationInput) => string);
  releaseFromName: (name: string) => string | null;
  release_pattern: ReleasePattern;
}> = [
  {
    match: (p) =>
      /bardstown/i.test(`${p.brand ?? ""} ${p.name}`) &&
      /fusion series/i.test(p.name),
    canonical: "Fusion Series",
    releaseFromName: (name) => extractBatchNumber(name),
    release_pattern: "batch",
  },
  {
    match: (p) =>
      /bardstown/i.test(`${p.brand ?? ""} ${p.name}`) &&
      /discovery series/i.test(p.name),
    canonical: "Discovery Series",
    releaseFromName: (name) => extractBatchNumber(name),
    release_pattern: "batch",
  },
  {
    match: (p) =>
      /four roses/i.test(`${p.brand ?? ""} ${p.name}`) &&
      /limited edition small batch/i.test(p.name),
    canonical: "Four Roses Limited Edition Small Batch",
    releaseFromName: (name) => extractReleaseYear(name),
    release_pattern: "year",
  },
  {
    match: (p) =>
      /four roses/i.test(`${p.brand ?? ""} ${p.name}`) &&
      /limited edition single barrel/i.test(p.name),
    canonical: "Four Roses Limited Edition Single Barrel",
    releaseFromName: (name) => extractReleaseYear(name),
    release_pattern: "year",
  },
  {
    match: (p) =>
      /four roses/i.test(`${p.brand ?? ""} ${p.name}`) &&
      /single barrel/i.test(p.name) &&
      !/limited edition/i.test(p.name),
    canonical: "Four Roses Single Barrel",
    releaseFromName: (name) => extractPickLabel(name),
    release_pattern: "pick",
  },
];

type BrandExpressionRule = {
  match: (p: NormalizationInput) => boolean;
  expressionLabel: (p: NormalizationInput) => string;
  kind: ExpressionKind;
  releaseFromName?: (p: NormalizationInput) => string | null;
  release_pattern?: ReleasePattern;
  vintages_matter?: boolean;
  spirit_type?: SpiritType;
  canonicalBrand?: string;
  /** When set, use exactly this catalog name (skip brand prefix). */
  fixedCanonical?: string;
};

function isBarrellBrand(p: NormalizationInput): boolean {
  return p.brand === "Barrell" || p.brand === "Barrell Craft Spirits";
}

function isBarrellNewYear(name: string): boolean {
  return /new year/i.test(name);
}

function isBarrellCaskStrength(p: NormalizationInput): boolean {
  if (isBarrellNewYear(p.name)) return false;
  return /cask[\s-]?strength/i.test(p.name);
}

function isBarrellCoreBourbon(p: NormalizationInput): boolean {
  if (isBarrellNewYear(p.name)) return false;
  if (isBarrellCaskStrength(p)) return false;
  if (
    /vantage|dovetail|seagrass|armida|foundation|gold label|cask finish series|private release|gray label/i.test(
      p.name,
    )
  ) {
    return false;
  }
  if (/barrell bourbon\s*\(\s*batch/i.test(p.name)) return true;
  if (/barrell\s+\d+\s*year\s*old\s+bourbon\s*\(\s*batch/i.test(p.name)) return true;
  if (/barrell blend of straight bourbons\s*\(\s*batch/i.test(p.name)) return true;
  return false;
}

function extractPrivateReleaseCode(name: string): string | null {
  const paren = name.match(/\(([A-Z][A-Z0-9]+)\)\s*$/i);
  return paren?.[1] ?? null;
}

export function extractBarrellBatchLabel(name: string): string | null {
  const batchParen = name.match(/\(\s*batch\s*(\d+)\s*\)/i);
  if (batchParen) return `Batch ${batchParen[1]}`;
  const batchInline = name.match(/\bbatch\s*(\d+)\b/i);
  if (batchInline) return `Batch ${batchInline[1]}`;
  return extractBatchNumber(name);
}

function extractBirthdayReleaseYear(input: NormalizationInput): string | null {
  const yearMade = specNum(input.specs, "year_made");
  if (yearMade != null && yearMade >= 1900 && yearMade <= 2100) return String(yearMade);
  const fromName = extractReleaseYear(input.name, yearMade);
  if (fromName) return fromName;
  const bottled = input.name.match(/\(\s*bottled\s+(20\d{2}|19\d{2})\s*\)/i);
  if (bottled) return bottled[1];
  const bareYear = input.name.match(/birthday bourbon\s+(20\d{2}|19\d{2})\b/i);
  if (bareYear) return bareYear[1];
  const vintage = input.name.match(/(?:,\s*)?(20\d{2}|19\d{2})\s*vintage/i);
  if (vintage) return vintage[1];
  const fallSpring = input.name.match(/(?:fall|spring)\s+(20\d{2}|19\d{2})/i);
  if (fallSpring) return fallSpring[1];
  return null;
}

function jimBeamBlackExpression(input: NormalizationInput): string {
  if (/extra-aged/i.test(input.name)) return "Black Extra-Aged";
  const tier = normalizeAgeTier(input);
  if (tier && /^black\b/i.test(input.name)) return `Black ${tier} Year`;
  if (/^black\b/i.test(input.name)) return "Black";
  return input.name.replace(/^black\s*/i, "Black ").trim();
}

function extractBarrellCaskFinishExpression(name: string): string {
  if (/amburana/i.test(name)) return "Amburana";
  if (/mizunara/i.test(name)) return "Mizunara";
  if (/tale of two islands/i.test(name)) return "Tale of Two Islands";
  const tail = name.replace(/.*cask finish series:?/i, "").trim();
  return tail || "Cask Finish";
}

const BRAND_EXPRESSION_RULES: BrandExpressionRule[] = [
  // —— Annual vintage series ——
  {
    match: (p) => /birthday bourbon|birthday kentucky straight/i.test(p.name),
    expressionLabel: () => "Birthday Bourbon",
    fixedCanonical: "Birthday Bourbon",
    canonicalBrand: "Old Forester",
    kind: "series",
    releaseFromName: extractBirthdayReleaseYear,
    release_pattern: "year",
  },

  // —— Angel's Envy (specific finishes before generic CS) ——
  {
    match: (p) =>
      p.brand === "Angel's Envy" &&
      /port finished cask strength/i.test(p.name),
    expressionLabel: () => "Port Finished Cask Strength",
    kind: "series",
    releaseFromName: (p) =>
      extractReleaseYear(p.name, specNum(p.specs, "year_made")),
    release_pattern: "year",
  },
  {
    match: (p) =>
      p.brand === "Angel's Envy" &&
      /cask strength port barrel/i.test(p.name),
    expressionLabel: () => "Cask Strength Port Barrel-Finished",
    kind: "series",
    releaseFromName: (p) =>
      extractReleaseYear(p.name, specNum(p.specs, "year_made")),
    release_pattern: "year",
  },
  {
    match: (p) =>
      p.brand === "Angel's Envy" &&
      /cask strength/i.test(p.name) &&
      !/port finished cask strength/i.test(p.name) &&
      !/port barrel/i.test(p.name),
    expressionLabel: () => "Cask Strength",
    kind: "series",
    releaseFromName: (p) =>
      extractReleaseYear(p.name, specNum(p.specs, "year_made")),
    release_pattern: "year",
  },
  {
    match: (p) => p.brand === "Angel's Envy" && /madeira/i.test(p.name),
    expressionLabel: () => "Madeira",
    kind: "identity",
  },
  {
    match: (p) => p.brand === "Angel's Envy" && /oloroso/i.test(p.name),
    expressionLabel: () => "Oloroso Sherry",
    kind: "identity",
  },
  {
    match: (p) => p.brand === "Angel's Envy" && /mizunara/i.test(p.name),
    expressionLabel: () => "Mizunara",
    kind: "identity",
  },
  {
    match: (p) =>
      p.brand === "Angel's Envy" &&
      /port finished/i.test(p.name) &&
      !/cask strength/i.test(p.name),
    expressionLabel: () => "Port Finished",
    kind: "identity",
  },
  {
    match: (p) => p.brand === "Angel's Envy" && /\brye\b/i.test(p.name),
    expressionLabel: () => "Rye",
    kind: "identity",
  },
  {
    match: (p) => p.brand === "Angel's Envy" && /private selection/i.test(p.name),
    expressionLabel: () => "Private Selection",
    kind: "identity",
  },

  // —— Baker's (age tier splits expressions) ——
  {
    match: (p) =>
      p.brand === "Baker's" &&
      /single barrel/i.test(p.name) &&
      normalizeAgeTier(p) === "13",
    expressionLabel: () => "Single Barrel 13 Year",
    kind: "series",
    releaseFromName: (p) => extractBatchNumber(p.name) ?? extractPickLabel(p.name),
    release_pattern: "pick",
  },
  {
    match: (p) =>
      p.brand === "Baker's" &&
      /single barrel/i.test(p.name) &&
      normalizeAgeTier(p) === "7",
    expressionLabel: () => "Single Barrel 7 Year",
    kind: "series",
    releaseFromName: (p) => extractBatchNumber(p.name) ?? extractPickLabel(p.name),
    release_pattern: "pick",
  },

  // —— 1792 ——
  {
    match: (p) => p.brand === "1792" && /anniversary/i.test(p.name),
    expressionLabel: () => "Anniversary",
    kind: "identity",
  },
  {
    match: (p) => p.brand === "1792" && /bottled in bond/i.test(p.name),
    expressionLabel: () => "Bottled-in-Bond",
    kind: "identity",
  },
  {
    match: (p) => p.brand === "1792" && /port finish/i.test(p.name),
    expressionLabel: () => "Port Finish",
    kind: "identity",
  },
  {
    match: (p) => p.brand === "1792" && /sweet wheat/i.test(p.name),
    expressionLabel: () => "Sweet Wheat",
    kind: "identity",
  },
  {
    match: (p) => p.brand === "1792" && /12 year/i.test(p.name),
    expressionLabel: (p) => stripBrandPrefix(p.brand, p.name),
    kind: "identity",
  },
  {
    match: (p) => p.brand === "1792" && /full proof/i.test(p.name),
    expressionLabel: () => "Full Proof",
    kind: "series",
    releaseFromName: (p) => extractPickLabel(p.name) ?? extractBatchNumber(p.name),
    release_pattern: "pick",
  },
  {
    match: (p) =>
      p.brand === "1792" &&
      /single barrel/i.test(p.name) &&
      !/12 year/i.test(p.name),
    expressionLabel: () => "Single Barrel",
    kind: "series",
    releaseFromName: (p) => extractPickLabel(p.name) ?? extractBatchNumber(p.name),
    release_pattern: "pick",
  },
  {
    match: (p) =>
      p.brand === "1792" &&
      /small batch/i.test(p.name) &&
      !/12 year/i.test(p.name),
    expressionLabel: () => "Small Batch",
    kind: "series",
  },

  // —— Barrell (New Year before CS; brand merges to Barrell) ——
  {
    match: (p) => isBarrellBrand(p) && /new year/i.test(p.name),
    expressionLabel: () => "New Year",
    kind: "series",
    releaseFromName: (p) =>
      extractReleaseYear(p.name, specNum(p.specs, "year_made")),
    release_pattern: "year",
    canonicalBrand: "Barrell",
  },
  {
    match: (p) => isBarrellBrand(p) && /\bvantage\b/i.test(p.name),
    expressionLabel: () => "Vantage",
    kind: "identity",
    spirit_type: "bourbon",
    canonicalBrand: "Barrell",
  },
  {
    match: (p) => isBarrellBrand(p) && /\bdovetail\b/i.test(p.name),
    expressionLabel: () => "Dovetail",
    kind: "identity",
    spirit_type: "bourbon",
    canonicalBrand: "Barrell",
  },
  {
    match: (p) => isBarrellBrand(p) && /seagrass/i.test(p.name),
    expressionLabel: () => "Seagrass",
    kind: "identity",
    spirit_type: "rye",
    canonicalBrand: "Barrell",
  },
  {
    match: (p) => isBarrellBrand(p) && /cask finish series/i.test(p.name),
    expressionLabel: (p) => extractBarrellCaskFinishExpression(p.name),
    fixedCanonical: "Barrell Cask Finish Series",
    kind: "identity",
    canonicalBrand: "Barrell",
  },
  {
    match: (p) => isBarrellBrand(p) && /private release/i.test(p.name),
    expressionLabel: () => "Private Release",
    kind: "identity",
    releaseFromName: (p) => extractPrivateReleaseCode(p.name),
    release_pattern: "pick",
    canonicalBrand: "Barrell",
  },
  {
    match: (p) => isBarrellBrand(p) && /\barmida\b/i.test(p.name),
    expressionLabel: () => "Armida",
    kind: "identity",
    canonicalBrand: "Barrell",
  },
  {
    match: (p) => isBarrellBrand(p) && /\bfoundation\b/i.test(p.name),
    expressionLabel: () => "Foundation",
    kind: "identity",
    canonicalBrand: "Barrell",
  },
  {
    match: (p) => isBarrellBrand(p) && /gold label/i.test(p.name),
    expressionLabel: () => "Gold Label",
    kind: "identity",
    canonicalBrand: "Barrell",
  },
  {
    match: (p) =>
      isBarrellBrand(p) &&
      (specStr(p.specs, "expression_type")?.toLowerCase().includes("gray label") ||
        /\bgray label\b/i.test(p.name)),
    expressionLabel: () => "Gray Label",
    kind: "identity",
    releaseFromName: (p) =>
      extractReleaseYear(p.name, specNum(p.specs, "year_made")),
    release_pattern: "year",
    canonicalBrand: "Barrell",
  },
  {
    match: (p) => isBarrellBrand(p) && isBarrellCaskStrength(p),
    expressionLabel: () => "Bourbon Cask Strength",
    kind: "series",
    releaseFromName: (p) =>
      extractBarrellBatchLabel(p.name) ??
      extractReleaseYear(p.name, specNum(p.specs, "year_made")),
    release_pattern: "batch",
    vintages_matter: false,
    canonicalBrand: "Barrell",
  },
  {
    match: (p) => isBarrellBrand(p) && isBarrellCoreBourbon(p),
    expressionLabel: () => "Bourbon",
    kind: "series",
    releaseFromName: (p) => extractBarrellBatchLabel(p.name),
    release_pattern: "batch",
    vintages_matter: false,
    canonicalBrand: "Barrell",
  },

  // —— Jim Beam ——
  {
    match: (p) => p.brand === "Jim Beam" && /^black\b/i.test(p.name),
    expressionLabel: jimBeamBlackExpression,
    kind: "identity",
  },
];

function specNum(specs: Record<string, unknown> | null, key: string): number | null {
  const v = specs?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function specStr(specs: Record<string, unknown> | null, key: string): string | null {
  const v = specs?.[key];
  if (v === null || v === undefined || v === "") return null;
  return String(v).trim() || null;
}

export function ageInName(name: string): string | null {
  const m = name.match(AGE_IN_NAME);
  return m ? m[0].toLowerCase() : null;
}

/** Numeric age tier from specs.age_label or age in product name. */
export function normalizeAgeTier(input: NormalizationInput): string | null {
  const ageLabel = specStr(input.specs, "age_label");
  if (ageLabel) {
    const m = ageLabel.match(/(\d{1,2})/);
    if (m) return m[1];
  }
  const fromName = ageInName(input.name);
  if (fromName) {
    const m = fromName.match(/(\d{1,2})/);
    if (m) return m[1];
  }
  return null;
}

export function formatBrandExpression(brand: string | null, expressionLabel: string): string {
  if (!brand) return expressionLabel;
  if (expressionLabel.toLowerCase().startsWith(brand.toLowerCase())) return expressionLabel;
  return `${brand} ${expressionLabel}`;
}

function stripBrandPrefix(brand: string | null, name: string): string {
  if (!brand) return name;
  const re = new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i");
  return name.replace(re, "").trim();
}

function normalizeComparableName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['',]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function namesMatchSurvivor(name: string, canonical: string): boolean {
  return normalizeComparableName(name) === normalizeComparableName(canonical);
}

export function isSeriesExpressionType(specs: Record<string, unknown> | null): boolean {
  const et = specStr(specs, "expression_type");
  if (!et) return false;
  const lower = et.toLowerCase();
  return SERIES_EXPRESSION_TOKENS.some((token) => lower.includes(token));
}

export function neverCollapseLine(input: NormalizationInput): boolean {
  const hay = `${input.brand ?? ""} ${input.name}`;
  return NEVER_COLLAPSE.some((re) => re.test(hay));
}

export function blockedByExpressionType(
  specs: Record<string, unknown> | null,
  isSeries = false,
): boolean {
  if (isSeries) return false;
  const et = specStr(specs, "expression_type");
  if (!et) return false;
  return et.toLowerCase() !== "straight bourbon";
}

export function extractReleaseYear(name: string, yearMade?: number | null): string | null {
  if (yearMade != null && yearMade >= 1900 && yearMade <= 2100) return String(yearMade);
  const paren = name.match(/\(\s*(20\d{2}|19\d{2})\s*(?:release|edition|vintage)?\s*\)/i);
  if (paren) return paren[1];
  const suffix = name.match(/(?:^|[\s,(])(20\d{2}|19\d{2})\s*(?:release|edition|vintage)\b/i);
  if (suffix) return suffix[1];
  const booker = name.match(/\b(20\d{2})-\d{2}\b/);
  if (booker) return booker[1];
  return null;
}

export function extractBatchNumber(name: string): string | null {
  const hash = name.match(/#\s*(\d+)/i);
  if (hash) return `#${hash[1]}`;
  const no = name.match(/\bno\.?\s*(\d+)/i);
  if (no) return `#${no[1]}`;
  const bare = name.match(/series\s+(\d+)\b/i);
  if (bare) return `#${bare[1]}`;
  return null;
}

function extractPickLabel(name: string): string | null {
  const store = name.match(/store pick[^)]*?(?:\(([^)]+)\))?/i);
  if (store?.[1]) return store[1].trim();
  const barrel = name.match(/barrel\s*(?:#|no\.?)\s*(\w+)/i);
  if (barrel) return `Barrel ${barrel[1]}`;
  return null;
}

function stripReleaseSuffixes(name: string): string {
  return name
    .replace(/\s*\(\s*(20\d{2}|19\d{2})\s*(?:release|edition|vintage)?\s*\)/gi, "")
    .replace(/\s*(20\d{2}|19\d{2})\s*(?:release|edition|vintage)\b/gi, "")
    .replace(/\s*\(\s*no\.?\s*[\d.]+\s*\)/gi, "")
    .replace(/\s*(?:#\s*\d+|no\.?\s*[\d.]+)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function inferVintagesMatter(_canonical: string): {
  vintages_matter: boolean;
  pattern: ReleasePattern | null;
} {
  return { vintages_matter: false, pattern: null };
}

function resolveBrandExpression(input: NormalizationInput): {
  canonical: string;
  canonical_brand: string | null;
  expression_label: string | null;
  spirit_type: SpiritType | null;
  release_label: string | null;
  release_pattern: ReleasePattern | null;
  vintages_matter: boolean;
  kind: ExpressionKind;
} | null {
  for (const rule of BRAND_EXPRESSION_RULES) {
    if (!rule.match(input)) continue;
    const expressionLabel = rule.expressionLabel(input);
    const brand = rule.canonicalBrand ?? input.brand;
    const canonical =
      rule.fixedCanonical ?? formatBrandExpression(brand, expressionLabel);
    const release_label = rule.releaseFromName ? rule.releaseFromName(input) : null;
    const vintageFromCanonical = inferVintagesMatter(canonical);
    const vintages_matter = rule.vintages_matter ?? vintageFromCanonical.vintages_matter;
    const release_pattern =
      rule.release_pattern ?? vintageFromCanonical.pattern ?? null;

    return {
      canonical,
      canonical_brand: rule.canonicalBrand ?? null,
      expression_label: expressionLabel,
      spirit_type: rule.spirit_type ?? null,
      release_label:
        namesMatchSurvivor(input.name, canonical) || input.name === canonical
          ? null
          : release_label,
      release_pattern,
      vintages_matter,
      kind: rule.kind,
    };
  }
  return null;
}

function resolveCanonical(
  input: NormalizationInput,
  context: NormalizationContext,
): {
  canonical: string;
  canonical_brand: string | null;
  expression_label: string | null;
  spirit_type: SpiritType | null;
  release_label: string | null;
  release_pattern: ReleasePattern | null;
  vintages_matter: boolean;
  kind: ExpressionKind | null;
} {
  for (const series of SERIES_CANONICAL) {
    if (!series.match(input)) continue;
    const canonical =
      typeof series.canonical === "function" ? series.canonical(input) : series.canonical;
    const yearMade = specNum(input.specs, "year_made");
    const fromName = series.releaseFromName(input.name);
    const release_label =
      series.release_pattern === "year"
        ? extractReleaseYear(input.name, yearMade) ?? fromName
        : fromName ?? (yearMade != null ? String(yearMade) : null);
    const vintage = inferVintagesMatter(canonical);
    return {
      canonical,
      canonical_brand: null,
      expression_label: null,
      spirit_type: null,
      release_label:
        input.name === canonical || namesMatchSurvivor(input.name, canonical)
          ? null
          : release_label,
      release_pattern: vintage.pattern ?? series.release_pattern,
      vintages_matter: vintage.vintages_matter,
      kind: "series",
    };
  }

  const lineBrand = resolveLineBrand(input, context);
  if (lineBrand) {
    const canonical = formatLineBrandCanonical(lineBrand.lineBrand, lineBrand.expression);
    return {
      canonical,
      canonical_brand: lineBrand.lineBrand,
      expression_label: lineBrand.expression || null,
      spirit_type: lineBrand.spirit_type,
      release_label: lineBrand.release_label,
      release_pattern: lineBrand.release_pattern,
      vintages_matter: lineBrand.vintages_matter,
      kind: lineBrand.kind,
    };
  }

  const brandRule = resolveBrandExpression(input);
  if (brandRule) return brandRule;

  const yearMade = specNum(input.specs, "year_made");
  const batch = extractBatchNumber(input.name);
  const year = extractReleaseYear(input.name, yearMade);
  let canonical = stripReleaseSuffixes(input.name);
  let release_label: string | null = null;
  let release_pattern: ReleasePattern | null = null;

  if (batch && canonical !== input.name) {
    release_label = batch;
    release_pattern = "batch";
  } else if (year && canonical !== input.name) {
    release_label = year;
    release_pattern = "year";
  } else if (yearMade != null && canonical !== input.name) {
    release_label = String(yearMade);
    release_pattern = "year";
  }

  const vintage = inferVintagesMatter(canonical);
  const kind: ExpressionKind | null = isSeriesExpressionType(input.specs) ? "series" : null;
  return {
    canonical,
    canonical_brand: null,
    expression_label: null,
    spirit_type: null,
    release_label,
    release_pattern: vintage.pattern ?? release_pattern,
    vintages_matter: vintage.vintages_matter,
    kind,
  };
}

const EMPTY_CONTEXT: NormalizationContext = { lineBrandPrefixCounts: new Map() };

export function proposeNormalization(
  input: NormalizationInput,
  context: NormalizationContext = EMPTY_CONTEXT,
): NormalizationProposal {
  const cleanup = cleanCatalogDisplayName(input);
  const {
    canonical,
    canonical_brand,
    expression_label,
    spirit_type,
    release_label: resolvedRelease,
    release_pattern: resolvedPattern,
    kind,
  } = resolveCanonical(input, context);

  const release_label = resolvedRelease ?? cleanup.releaseLabel;
  const release_pattern = resolvedPattern ?? cleanup.releasePattern;
  const vintages_matter = false;
  const cleanedName = cleanup.displayName;

  const isSeries = kind === "series" || (kind === null && isSeriesExpressionType(input.specs));
  let is_survivor =
    input.name === canonical ||
    namesMatchSurvivor(input.name, canonical) ||
    cleanedName === canonical ||
    namesMatchSurvivor(cleanedName, canonical);
  if (kind === "series" && release_label) is_survivor = false;
  const age = ageInName(input.name);
  const ageTier = normalizeAgeTier(input);
  const ageEncodedInCanonical = ageTier != null && canonical.includes(ageTier);
  const ageBlocksCollapse =
    age != null &&
    !ageEncodedInCanonical &&
    !(isSeries && release_pattern === "batch") &&
    !(isSeries && release_pattern === "year" && release_label != null);
  const never = neverCollapseLine(input);
  const blocked = blockedByExpressionType(input.specs, isSeries);

  let skip_reason: string | null = null;
  if (never) skip_reason = "never_collapse_line";
  else if (ageBlocksCollapse) skip_reason = `age_in_name:${age}`;
  else if (blocked) skip_reason = `expression_type:${specStr(input.specs, "expression_type")}`;
  else if (is_survivor) skip_reason = "survivor_row";
  else if (!release_label && canonical === cleanedName) skip_reason = "already_canonical";

  const variantSeries = kind === "series" && release_label != null;
  const collapse =
    skip_reason === null &&
    !is_survivor &&
    (canonical !== cleanedName || variantSeries) &&
    kind !== "identity";

  return {
    canonical_name: canonical,
    canonical_brand,
    expression_label,
    spirit_type,
    release_label: is_survivor ? null : release_label,
    release_pattern,
    vintages_matter,
    collapse,
    is_survivor,
    skip_reason,
    age_in_name: age,
    never_collapse_line: never,
    blocked_by_expression_type: blocked,
  };
}

/** Apply group-level rules: need 2+ rows sharing canonical, and a survivor or proposed one. */
export function finalizeCollapseProposals(
  rows: Array<NormalizationInput & { proposal: NormalizationProposal }>,
): Array<NormalizationInput & { proposal: NormalizationProposal }> {
  const byCanonical = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byCanonical.get(row.proposal.canonical_name) ?? [];
    list.push(row);
    byCanonical.set(row.proposal.canonical_name, list);
  }

  return rows.map((row) => {
    const group = byCanonical.get(row.proposal.canonical_name) ?? [row];
    if (group.length < 2) {
      if (row.proposal.collapse) {
        return {
          ...row,
          proposal: {
            ...row.proposal,
            collapse: false,
            skip_reason: row.proposal.skip_reason ?? "singleton_group",
          },
        };
      }
      return row;
    }

    const ageTiers = group
      .map((r) => normalizeAgeTier(r))
      .filter((a): a is string => a != null);
    const ageTierDefinesExpression = group.some((r) => {
      const tier = normalizeAgeTier(r);
      return tier != null && r.proposal.canonical_name.includes(tier);
    });
    if (ageTierDefinesExpression && new Set(ageTiers).size > 1) {
      return {
        ...row,
        proposal: {
          ...row.proposal,
          collapse: false,
          skip_reason: "group:mixed_age_tier",
        },
      };
    }

    return row;
  });
}
