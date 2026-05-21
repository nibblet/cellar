/**
 * Normalize a bourbon product's identity for soft-duplicate matching across
 * datasets that format names differently.
 *
 * Why we need this: bourbonExplorer formats bottles as
 *   "Buffalo Trace Stagg Jr., 65.05%"
 * while the Cobb collection has the same bottle as
 *   brand="Stagg Jr.", name="Stagg Jr. Barrel Proof"
 *
 * Both refer to the same physical bourbon. Without a normalizer, they sit as
 * two separate `products` rows, splitting member tastings and confusing the
 * pairing engine.
 *
 * Strategy: collapse to a set of comparable tokens by stripping ABV/proof
 * suffixes, year-of-release markers, punctuation, and case. Then match by
 * token containment (one row's tokens must be a subset of the other's).
 *
 * Bias: prefer false negatives over false positives. A missed match leaves
 * a soft duplicate (recoverable later); a wrong merge destroys distinct
 * products. The matcher's job is to catch the obvious cases.
 */

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "and",
  "with",
  "in",
  "on",
  "by",
  "old", // "10 year old" → "10 year"
]);

/**
 * Strip ABV/proof percent suffixes ("..., 50%", ", 116.8%", ", 65.05%").
 */
function stripAbvSuffix(input: string): string {
  return input.replace(/,?\s*\d+(?:\.\d+)?\s*%?\s*$/u, "").trim();
}

/**
 * Strip "(YYYY Release)" / "(YYYY Vintage)" / "(2014 release)" patterns.
 */
function stripYearMarker(input: string): string {
  return input
    .replace(/\(\s*\d{4}\s+(?:release|vintage|edition)\s*\)/gi, "")
    .replace(/,?\s*\d{4}\s+vintage\b/gi, "")
    .trim();
}

/**
 * Normalize a free-form product name into comparison tokens:
 *   1. Strip ABV + year markers
 *   2. Lowercase + strip diacritics + remove apostrophes
 *   3. Replace punctuation with whitespace
 *   4. Tokenize on whitespace
 *   5. Drop stop words
 */
export function normalizeTokens(input: string): string[] {
  const cleaned = stripYearMarker(stripAbvSuffix(input))
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/['']/g, "") // strip apostrophes (don't → dont)
    .replace(/[^a-z0-9]+/g, " ") // everything else to whitespace
    .trim();

  if (!cleaned) return [];

  return cleaned
    .split(/\s+/)
    .filter((t) => t.length > 0 && !STOP_WORDS.has(t));
}

/**
 * Build a "canonical identity" string from brand + name. Used as a stable
 * Set key for batch dedup; tokens are sorted so token order doesn't matter.
 */
export function canonicalIdentity(brand: string | null, name: string): string {
  const tokens = normalizeTokens(`${brand ?? ""} ${name}`);
  return [...new Set(tokens)].sort().join(" ");
}

/**
 * Decide whether two products represent the same bottle. Conservative:
 * requires the smaller token set to be fully contained in the larger one,
 * AND at least 2 tokens in common (so single-token matches like "Pappy"
 * don't false-positive across "Pappy Van Winkle 12" and "Pappy 23").
 */
export type ProductIdentity = {
  brand: string | null;
  name: string;
};

export function looksLikeSameProduct(
  a: ProductIdentity,
  b: ProductIdentity,
): boolean {
  const aTokens = new Set(normalizeTokens(`${a.brand ?? ""} ${a.name}`));
  const bTokens = new Set(normalizeTokens(`${b.brand ?? ""} ${b.name}`));

  if (aTokens.size === 0 || bTokens.size === 0) return false;

  const [smaller, larger] = aTokens.size <= bTokens.size ? [aTokens, bTokens] : [bTokens, aTokens];

  if (smaller.size < 2) return false;

  for (const t of smaller) {
    if (!larger.has(t)) return false;
  }
  return true;
}

/**
 * Score how confident the match is. 1.0 = identical token sets; lower as
 * one side has many more tokens than the other. Useful for sorting/review.
 */
export function matchConfidence(a: ProductIdentity, b: ProductIdentity): number {
  const aTokens = new Set(normalizeTokens(`${a.brand ?? ""} ${a.name}`));
  const bTokens = new Set(normalizeTokens(`${b.brand ?? ""} ${b.name}`));

  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  let intersection = 0;
  for (const t of aTokens) if (bTokens.has(t)) intersection += 1;

  const union = aTokens.size + bTokens.size - intersection;
  return intersection / union; // Jaccard
}
