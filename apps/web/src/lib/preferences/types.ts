/**
 * Member preferences vocabulary. Positives-only by design — there is no
 * "avoid" list, so feature gates light only when the member has opted into
 * at least one trait.
 *
 * Vocabularies are intentionally narrower than the raw catalog columns:
 *   - Cigar wrappers collapse 20+ raw values into 8 buckets members recognize.
 *   - Bourbon styles are derived from whiskey_type / mash_bill rather than
 *     the sparse style_family column.
 *   - Proof bands are 3 coarse buckets, not a slider — keeps the UI in chips.
 */

export const CIGAR_STRENGTHS = ["mild", "mild-medium", "medium", "medium-full", "full"] as const;
export type CigarStrength = (typeof CIGAR_STRENGTHS)[number];

export const CIGAR_WRAPPER_BUCKETS = [
  "connecticut",
  "habano",
  "maduro",
  "san-andres",
  "corojo",
  "sumatra",
  "cameroon",
  "oscuro",
] as const;
export type CigarWrapperBucket = (typeof CIGAR_WRAPPER_BUCKETS)[number];

export const BOURBON_STYLES = [
  "bourbon",
  "rye",
  "wheated",
  "high-rye",
  "bottled-in-bond",
  "single-barrel",
] as const;
export type BourbonStyle = (typeof BOURBON_STYLES)[number];

export const BOURBON_PROOF_BANDS = ["low", "mid", "high"] as const;
export type BourbonProofBand = (typeof BOURBON_PROOF_BANDS)[number];

/** Cobb/LLM tier ceiling for catalog browse — 2 = common shelf … 5 = show all. */
export const CATALOG_TIER_FLOOR = 2;
export const CATALOG_TIER_CEILING = 5;
export const DEFAULT_MAX_CATALOG_TIER = 2;

export type MemberPreferences = {
  cigar_strengths: CigarStrength[];
  cigar_wrappers: CigarWrapperBucket[];
  bourbon_styles: BourbonStyle[];
  bourbon_proof_bands: BourbonProofBand[];
  /** Show products with specs.tier <= this value; unknown tier always shown. */
  max_catalog_tier: number;
};

export const EMPTY_PREFERENCES: MemberPreferences = {
  cigar_strengths: [],
  cigar_wrappers: [],
  bourbon_styles: [],
  bourbon_proof_bands: [],
  max_catalog_tier: DEFAULT_MAX_CATALOG_TIER,
};

export function hasAnyPreferences(prefs: MemberPreferences): boolean {
  return (
    prefs.cigar_strengths.length > 0 ||
    prefs.cigar_wrappers.length > 0 ||
    prefs.bourbon_styles.length > 0 ||
    prefs.bourbon_proof_bands.length > 0
  );
}

/**
 * Display labels for chip text and tag clouds.
 */
export const CIGAR_STRENGTH_LABEL: Record<CigarStrength, string> = {
  mild: "Mild",
  "mild-medium": "Mild–Medium",
  medium: "Medium",
  "medium-full": "Medium–Full",
  full: "Full",
};

export const CIGAR_WRAPPER_LABEL: Record<CigarWrapperBucket, string> = {
  connecticut: "Connecticut",
  habano: "Habano",
  maduro: "Maduro / Broadleaf",
  "san-andres": "San Andrés",
  corojo: "Corojo",
  sumatra: "Sumatra",
  cameroon: "Cameroon",
  oscuro: "Oscuro",
};

export const BOURBON_STYLE_LABEL: Record<BourbonStyle, string> = {
  bourbon: "Bourbon",
  rye: "Rye",
  wheated: "Wheated",
  "high-rye": "High-rye",
  "bottled-in-bond": "Bottled-in-Bond",
  "single-barrel": "Single Barrel",
};

export const BOURBON_PROOF_BAND_LABEL: Record<BourbonProofBand, string> = {
  low: "Low (≤90)",
  mid: "Mid (90–110)",
  high: "High (≥110)",
};

export const MAX_CATALOG_TIER_LABEL: Record<number, string> = {
  2: "Common — shelf staples",
  3: "Through uncommon — seasonal & limited",
  4: "Through rare allocations",
  5: "Everything — lottery & unicorns",
};
