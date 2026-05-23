import type { ProductType } from "@/lib/wheel";

/** 1 = $ … 4 = $$$$ — ordinal bucket, not a dollar amount. */
export type PriceBucket = 1 | 2 | 3 | 4;

export type RarityLabel = "common" | "uncommon" | "rare";

/** Show-all sentinel for catalog tier filter. */
export const CATALOG_TIER_CEILING = 5;

export type NormalizedProductSpecs = {
  /** Coalesced `price_usd` then `msrp_usd`. */
  priceUsd: number | null;
  /** StickPicks ordinal 1–5 when present. */
  cigarPriceTier: number | null;
  /** Display bucket when enough signal exists; null hides the strip token. */
  priceBucket: PriceBucket | null;
  /** Cobb collection tier 1–5 (`specs.tier`). Not club-wide rarity. */
  cobbTier: number | null;
  /** Derived from tier when present — Common / Uncommon / Rare. */
  rarityLabel: RarityLabel | null;
};

const CIGAR_USD_THRESHOLDS = [
  { max: 10, bucket: 1 as const },
  { max: 25, bucket: 2 as const },
  { max: 50, bucket: 3 as const },
] as const;

const BOURBON_USD_THRESHOLDS = [
  { max: 35, bucket: 1 as const },
  { max: 75, bucket: 2 as const },
  { max: 150, bucket: 3 as const },
] as const;

function numFromSpec(specs: Record<string, unknown>, key: string): number | null {
  const raw = specs[key];
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === "string") {
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

/** Dollar price when any seed/enrichment path wrote one. */
export function normalizePriceUsd(
  specs: Record<string, unknown> | null | undefined,
): number | null {
  if (!specs) return null;
  return numFromSpec(specs, "price_usd") ?? numFromSpec(specs, "msrp_usd");
}

/** StickPicks `price_tier` ordinal (1 = value … 5 = ultra-premium). */
export function normalizeCigarPriceTier(
  specs: Record<string, unknown> | null | undefined,
): number | null {
  if (!specs) return null;
  const raw = specs.price_tier;
  if (typeof raw !== "number" || !Number.isInteger(raw)) return null;
  if (raw < 1 || raw > 5) return null;
  return raw;
}

export function normalizeCobbTier(
  specs: Record<string, unknown> | null | undefined,
): number | null {
  if (!specs) return null;
  const raw = specs.tier;
  if (typeof raw !== "number" || !Number.isInteger(raw)) return null;
  if (raw < 1 || raw > 5) return null;
  return raw;
}

/** Map tier 1–5 to display rarity — aligned with roadmap #24. */
export function tierToRarityLabel(tier: number): RarityLabel | null {
  if (!Number.isInteger(tier) || tier < 1 || tier > 5) return null;
  if (tier <= 2) return "common";
  if (tier === 3) return "uncommon";
  return "rare";
}

export function formatRarityLabel(label: RarityLabel): string {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Catalog visibility — unknown tier stays visible; max 5 shows all. */
export function productVisibleWithMaxCatalogTier(
  specs: Record<string, unknown> | null | undefined,
  maxCatalogTier: number,
): boolean {
  if (maxCatalogTier >= CATALOG_TIER_CEILING) return true;
  const tier = normalizeCobbTier(specs);
  if (tier == null) return true;
  return tier <= maxCatalogTier;
}

export function priceUsdToBucket(priceUsd: number, productType: ProductType): PriceBucket {
  const thresholds = productType === "cigar" ? CIGAR_USD_THRESHOLDS : BOURBON_USD_THRESHOLDS;
  for (const { max, bucket } of thresholds) {
    if (priceUsd < max) return bucket;
  }
  return 4;
}

/**
 * Map StickPicks 1–5 ordinal directly onto $…$$$$.
 * Cigars almost always carry `price_tier`; dollar MSRP is the override when present.
 */
export function cigarPriceTierToBucket(tier: number): PriceBucket {
  if (tier <= 1) return 1;
  if (tier === 2) return 2;
  if (tier === 3) return 3;
  return 4;
}

/**
 * Cigar-first: `price_tier` → bucket; dollar fields override when present.
 * Bourbon: opportunistic — bucket only when `price_usd` / `msrp_usd` exists.
 */
export function resolvePriceBucket(
  productType: ProductType,
  specs: Record<string, unknown> | null | undefined,
): PriceBucket | null {
  const priceUsd = normalizePriceUsd(specs);

  if (productType === "cigar") {
    if (priceUsd != null) return priceUsdToBucket(priceUsd, "cigar");
    const tier = normalizeCigarPriceTier(specs);
    if (tier != null) return cigarPriceTierToBucket(tier);
    return null;
  }

  if (priceUsd != null) return priceUsdToBucket(priceUsd, "bourbon");
  return null;
}

export function formatPriceBucket(bucket: PriceBucket): string {
  return "$".repeat(bucket);
}

export function normalizeProductSpecs(
  productType: ProductType,
  specs: Record<string, unknown> | null | undefined,
): NormalizedProductSpecs {
  const cobbTier = productType === "bourbon" ? normalizeCobbTier(specs) : null;
  return {
    priceUsd: normalizePriceUsd(specs),
    cigarPriceTier: productType === "cigar" ? normalizeCigarPriceTier(specs) : null,
    priceBucket: resolvePriceBucket(productType, specs),
    cobbTier,
    rarityLabel: cobbTier != null ? tierToRarityLabel(cobbTier) : null,
  };
}

/** Spec keys consumed by normalization — omit from the raw Facts strip. */
export const NORMALIZED_SPEC_KEYS = new Set([
  "price_usd",
  "msrp_usd",
  "price_tier",
  "tier",
  "tier_source",
  "tier_rationale",
]);
