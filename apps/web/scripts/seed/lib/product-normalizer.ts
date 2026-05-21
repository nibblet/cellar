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
 * Tokens that signal an expression style (rye recipe vs. bourbon recipe).
 * If one side has any of these as a standalone token and the other side
 * lacks them entirely, the two products are distinct expressions even if
 * their other tokens overlap by subset.
 *
 * Calibrated from real false-positive cases in the first dedupe pass:
 *   - Woodford Reserve Distiller's Select Rye  vs.  Woodford Reserve Distiller's Select (bourbon)
 *
 * "malt"/"wheat" are deliberately omitted — "malted barley" appears in
 * almost every bourbon mash bill and would produce noisy matches.
 */
const EXPRESSION_TOKENS = new Set(["rye"]);

/**
 * Multi-word phrases that mark a distinct sub-line (not a batch). If one
 * side mentions one of these and the other doesn't, the products are NOT
 * the same line even if their other tokens overlap.
 *
 * Calibrated from real false-positive cases:
 *   - New Riff Kentucky Straight Rye  vs.  New Riff Maltster BiB (Rye Recipe)
 *   - Buffalo Trace Single Oak Project Barrel #80  vs.  plain Buffalo Trace
 *
 * Phrases are checked by joining the normalized token sequence into a
 * single string and doing substring containment.
 */
const SUBLINE_PHRASES = [
  "single oak project",
  "maltster",
  "experimental",
  "prototype",
];

function hasSubLineMarker(joined: string): string | null {
  for (const phrase of SUBLINE_PHRASES) {
    if (joined.includes(phrase)) return phrase;
  }
  return null;
}

/**
 * Decide whether two products represent the same bottle. Conservative:
 * requires the smaller token set to be fully contained in the larger one,
 * AND at least 2 tokens in common, AND no expression / sub-line mismatch.
 *
 * Calibration notes:
 *   - First-pass matcher (subset + ≥2 tokens) produced 3 false positives in
 *     a 1,098-row run. All three involved either an expression marker (`rye`
 *     vs. no rye) or a sub-line phrase (`single oak project`, `maltster`).
 *   - Rules R1 + R2 below catch those without rejecting clean batch-level
 *     merges (Elijah Craig batches, Larceny batches, Bardstown Fusion #s,
 *     Maker's Mark FAE codes) which the catalog treats as line-level.
 */
export type ProductIdentity = {
  brand: string | null;
  name: string;
};

export function looksLikeSameProduct(
  a: ProductIdentity,
  b: ProductIdentity,
): boolean {
  const aTokenList = normalizeTokens(`${a.brand ?? ""} ${a.name}`);
  const bTokenList = normalizeTokens(`${b.brand ?? ""} ${b.name}`);
  const aTokens = new Set(aTokenList);
  const bTokens = new Set(bTokenList);

  if (aTokens.size === 0 || bTokens.size === 0) return false;

  const [smaller, larger] = aTokens.size <= bTokens.size ? [aTokens, bTokens] : [bTokens, aTokens];

  if (smaller.size < 2) return false;

  // R0: subset containment (existing rule).
  for (const t of smaller) {
    if (!larger.has(t)) return false;
  }

  // R1: expression token asymmetry. If exactly one side has "rye" (or future
  // markers in EXPRESSION_TOKENS), the products are different expressions.
  for (const tok of EXPRESSION_TOKENS) {
    if (aTokens.has(tok) !== bTokens.has(tok)) return false;
  }

  // R2: sub-line phrase asymmetry. If one side names a sub-line and the
  // other doesn't, they're different products.
  const aJoined = aTokenList.join(" ");
  const bJoined = bTokenList.join(" ");
  const aSub = hasSubLineMarker(aJoined);
  const bSub = hasSubLineMarker(bJoined);
  if ((aSub && !bSub) || (!aSub && bSub)) return false;
  if (aSub && bSub && aSub !== bSub) return false;

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
