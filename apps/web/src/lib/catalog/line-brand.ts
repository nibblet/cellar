/**
 * Line brand promotion — distillery buckets (Buffalo Trace) where the true
 * brand is embedded in the product name. See planning/catalog-expression-collapse.md Rule 0.
 */

import type { ExpressionKind, NormalizationInput, ReleasePattern, SpiritType } from "./expression-normalize";

export type NormalizationContext = {
  /** Name-prefix → count within distillery bucket rows */
  lineBrandPrefixCounts: Map<string, number>;
};

function specNum(specs: Record<string, unknown> | null, key: string): number | null {
  const v = specs?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function ageInName(name: string): string | null {
  const m = name.match(/\b(\d{1,2})\s*(?:year|yr|years)\b/i);
  return m ? m[0].toLowerCase() : null;
}

function normalizeAgeTier(input: NormalizationInput): string | null {
  const ageLabel = input.specs?.age_label;
  if (ageLabel != null && ageLabel !== "") {
    const m = String(ageLabel).match(/(\d{1,2})/);
    if (m) return m[1];
  }
  const fromName = ageInName(input.name);
  if (fromName) {
    const m = fromName.match(/(\d{1,2})/);
    if (m) return m[1];
  }
  return null;
}

function extractReleaseYear(name: string, yearMade?: number | null): string | null {
  if (yearMade != null && yearMade >= 1900 && yearMade <= 2100) return String(yearMade);
  const paren = name.match(/\(\s*(20\d{2}|19\d{2})\s*(?:release|edition|vintage)?\s*\)/i);
  if (paren) return paren[1];
  const suffix = name.match(/(?:^|[\s,(])(20\d{2}|19\d{2})\s*(?:release|edition|vintage)\b/i);
  if (suffix) return suffix[1];
  return null;
}

/** Catalog brand values treated as distillery parents, not member-facing line brands. */
export const DISTILLERY_BUCKETS = new Set(["Buffalo Trace"]);

/** Always promote when name starts with prefix (longest match wins). */
const CURATED_LINE_BRAND_PREFIXES: Array<{ prefix: RegExp; brand: string }> = [
  { prefix: /^experimental collection\b/i, brand: "Experimental Collection" },
  { prefix: /^william larue weller\b/i, brand: "William Larue Weller" },
  { prefix: /^pappy van winkle\b/i, brand: "Pappy Van Winkle" },
  { prefix: /^old rip van winkle\b/i, brand: "Old Rip Van Winkle" },
  { prefix: /^van winkle\b/i, brand: "Van Winkle" },
  { prefix: /^benchmark\b/i, brand: "Benchmark" },
  { prefix: /^ancient ancient age\b/i, brand: "Ancient Age" },
  { prefix: /^ancient age\b/i, brand: "Ancient Age" },
  { prefix: /^hancock'?s\b/i, brand: "Hancock's" },
  { prefix: /^old fashioned sour mash\b/i, brand: "Old Fashioned Sour Mash" },
  { prefix: /^old charter\b/i, brand: "Old Charter" },
  { prefix: /^blanton'?s?\b/i, brand: "Blanton's" },
];

/** Minimum shared prefix length (words) for heuristic promotion. */
const MIN_PREFIX_WORDS = 2;
const MIN_PREFIX_COUNT = 3;

const VAGUE_PREFIX_WORDS = new Set([
  "old",
  "buffalo",
  "french",
  "the",
  "kentucky",
  "straight",
  "experimental",
  "william",
  "barrell",
]);

export type LineBrandResolution = {
  lineBrand: string;
  expression: string;
  kind: ExpressionKind;
  release_label: string | null;
  release_pattern: ReleasePattern | null;
  vintages_matter: boolean;
  spirit_type: SpiritType | null;
};

export function normalizeCatalogBrand(brand: string | null): string | null {
  if (!brand) return null;
  if (brand === "Barrell Craft Spirits") return "Barrell";
  return brand;
}

function prefixKey(words: string[]): string {
  return words.join(" ").toLowerCase();
}

/** Count 2–4 word name prefixes for rows in distillery buckets. */
export function buildLineBrandPrefixCounts(inputs: NormalizationInput[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const input of inputs) {
    if (!input.brand || !DISTILLERY_BUCKETS.has(input.brand)) continue;
    const words = input.name.trim().split(/\s+/);
    for (let len = MIN_PREFIX_WORDS; len <= Math.min(4, words.length); len++) {
      const key = prefixKey(words.slice(0, len));
      if (VAGUE_PREFIX_WORDS.has(words[0].toLowerCase()) && len === MIN_PREFIX_WORDS) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

export function buildNormalizationContext(inputs: NormalizationInput[]): NormalizationContext {
  return { lineBrandPrefixCounts: buildLineBrandPrefixCounts(inputs) };
}

function detectCuratedLineBrand(name: string): string | null {
  for (const { prefix, brand } of CURATED_LINE_BRAND_PREFIXES) {
    if (prefix.test(name)) return brand;
  }
  return null;
}

function detectHeuristicLineBrand(
  name: string,
  prefixCounts: Map<string, number>,
): string | null {
  const words = name.trim().split(/\s+/);
  for (let len = Math.min(4, words.length); len >= MIN_PREFIX_WORDS; len--) {
    const key = prefixKey(words.slice(0, len));
    if ((prefixCounts.get(key) ?? 0) >= MIN_PREFIX_COUNT) {
      return words.slice(0, len).join(" ");
    }
  }
  return null;
}

function stripLineBrandPrefix(name: string, lineBrand: string): string {
  const re = new RegExp(`^${lineBrand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i");
  return name.replace(re, "").replace(/^,\s*/, "").trim();
}

function parseExperimentalCollectionExpression(name: string, remainder: string): {
  expression: string;
  kind: ExpressionKind;
} {
  if (/rediscovered barrels/i.test(name)) {
    return { expression: "Rediscovered Barrels", kind: "series" };
  }

  const floor = name.match(/from floor #(\d+)/i);
  if (floor) {
    const label = /wheated/i.test(name) ? `Floor #${floor[1]} Wheated Bourbon` : `Floor #${floor[1]} Bourbon`;
    return { expression: label, kind: "series" };
  }

  const commaBody = name.match(/^experimental collection\s*,\s*(.+)$/i);
  if (commaBody) {
    const parts = commaBody[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const substantive = parts.filter((p) => !/^\d{1,2}\s*year/i.test(p));
    if (substantive.length === 1) {
      return { expression: substantive[0], kind: "identity" };
    }
    if (substantive.length > 1 && /vintage/i.test(substantive[0])) {
      return { expression: substantive.slice(1).join(", ") || substantive[0], kind: "identity" };
    }
    return { expression: substantive[substantive.length - 1], kind: "identity" };
  }

  let expr = remainder
    .replace(/^#\d+\s+/i, "")
    .replace(/\s*,\s*\d+\s*year\s*old\s*$/i, "")
    .trim();
  if (!expr) expr = remainder.trim();
  return { expression: expr, kind: "identity" };
}

function parseBenchmarkExpression(remainder: string): string {
  if (/^bonded/i.test(remainder)) return "Bonded";
  if (/single barrel/i.test(remainder)) return "Single Barrel";
  if (/top floor/i.test(remainder)) return "Top Floor";
  if (/old no\.?\s*8/i.test(remainder)) return "Old No. 8";
  return remainder.trim();
}

function parsePappyExpression(input: NormalizationInput, lineBrand: string): {
  expression: string;
  kind: ExpressionKind;
} {
  const tier = normalizeAgeTier(input);
  if (tier) return { expression: `${tier} Year`, kind: "identity" };
  const bare = stripLineBrandPrefix(input.name, lineBrand);
  if (bare) return { expression: bare, kind: "identity" };
  return { expression: "Family Reserve", kind: "identity" };
}

function resolveWilliamLarueWeller(input: NormalizationInput): LineBrandResolution {
  const yearMade = specNum(input.specs, "year_made");
  const year =
    extractReleaseYear(input.name, yearMade) ?? (yearMade != null ? String(yearMade) : null);
  return {
    lineBrand: "William Larue Weller",
    expression: "",
    kind: "series",
    release_label: year,
    release_pattern: "year",
    vintages_matter: false,
    spirit_type: "bourbon",
  };
}

export function resolveLineBrand(
  input: NormalizationInput,
  context: NormalizationContext,
): LineBrandResolution | null {
  if (input.brand && !DISTILLERY_BUCKETS.has(input.brand)) {
    return null;
  }

  const curated = detectCuratedLineBrand(input.name);
  const heuristic =
    curated ??
    (input.brand && DISTILLERY_BUCKETS.has(input.brand)
      ? detectHeuristicLineBrand(input.name, context.lineBrandPrefixCounts)
      : null);

  if (!heuristic) return null;

  const lineBrand = curated ?? heuristic;
  const remainder = stripLineBrandPrefix(input.name, lineBrand);

  if (lineBrand === "William Larue Weller") {
    return resolveWilliamLarueWeller(input);
  }

  if (lineBrand === "Experimental Collection") {
    const { expression, kind } = parseExperimentalCollectionExpression(input.name, remainder);
    const yearMade = specNum(input.specs, "year_made");
    const release =
      kind === "series"
        ? extractReleaseYear(input.name, yearMade) ?? (yearMade != null ? String(yearMade) : null)
        : null;
    const spirit: SpiritType | null = /\brye\b/i.test(input.name) ? "rye" : "bourbon";
    return {
      lineBrand,
      expression,
      kind,
      release_label: release,
      release_pattern: kind === "series" ? "year" : null,
      vintages_matter: false,
      spirit_type: spirit,
    };
  }

  if (lineBrand === "Benchmark") {
    return {
      lineBrand,
      expression: parseBenchmarkExpression(remainder),
      kind: "identity",
      release_label: null,
      release_pattern: null,
      vintages_matter: false,
      spirit_type: "bourbon",
    };
  }

  if (lineBrand === "Pappy Van Winkle" || lineBrand === "Old Rip Van Winkle" || lineBrand === "Van Winkle") {
    const { expression, kind } = parsePappyExpression(input, lineBrand);
    const yearMade = specNum(input.specs, "year_made");
    return {
      lineBrand: lineBrand === "Van Winkle" ? "Van Winkle" : lineBrand,
      expression,
      kind,
      release_label: yearMade != null ? String(yearMade) : extractReleaseYear(input.name, yearMade),
      release_pattern: "year",
      vintages_matter: false,
      spirit_type: "bourbon",
    };
  }

  const expression = remainder || input.name;
  return {
    lineBrand,
    expression,
    kind: "identity",
    release_label: null,
    release_pattern: null,
    vintages_matter: false,
    spirit_type: /\brye\b/i.test(input.name) ? "rye" : null,
  };
}

export function formatLineBrandCanonical(lineBrand: string, expression: string): string {
  if (!expression.trim()) return lineBrand;
  if (expression.toLowerCase().startsWith(lineBrand.toLowerCase())) return expression;
  return `${lineBrand} ${expression}`;
}
