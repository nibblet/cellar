import type { ProductType } from "@/lib/wheel";

/** 1 = $ … 4 = $$$$ — ordinal bucket, not a dollar amount. */
export type PriceBucket = 1 | 2 | 3 | 4;

export type RarityLabel = "common" | "uncommon" | "rare";

/** Curated availability axis from bourbon curation (`specs.availability_rarity`). */
export type AvailabilityRarity =
  | "everyday"
  | "seasonal"
  | "allocated"
  | "lottery"
  | "secondary-only"
  | "discontinued";

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
  /** Derived from tier when no curated availability label exists. */
  rarityLabel: RarityLabel | null;
  /** Curated availability label when `availability_rarity` is set. */
  availabilityLabel: string | null;
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

const CIGAR_LENGTH_KEYS = ["length_inches", "length", "length_in"] as const;
const CIGAR_RING_KEYS = ["ring_gauge", "ring", "gauge"] as const;
const CIGAR_DIMENSION_STRING_KEYS = ["dimension", "size"] as const;

/** Standard cigar shorthand: `5.5" × 50`. Either side renders independently when alone. */
export function formatCigarDimensions(
  specs: Record<string, unknown> | null | undefined,
): string | null {
  if (!specs) return null;

  for (const key of CIGAR_DIMENSION_STRING_KEYS) {
    const raw = specs[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }

  const len =
    CIGAR_LENGTH_KEYS.map((k) => numFromSpec(specs, k)).find((n) => n != null) ?? null;
  const rg = CIGAR_RING_KEYS.map((k) => numFromSpec(specs, k)).find((n) => n != null) ?? null;

  const lenStr = len != null ? `${len}"` : null;
  const rgStr = rg != null ? `${Math.round(rg)}` : null;

  if (lenStr && rgStr) return `${lenStr} × ${rgStr}`;
  return lenStr ?? rgStr;
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

const AVAILABILITY_RARITY_VALUES = new Set<string>([
  "everyday",
  "seasonal",
  "allocated",
  "lottery",
  "secondary-only",
  "discontinued",
]);

export function normalizeAvailabilityRarity(
  specs: Record<string, unknown> | null | undefined,
): AvailabilityRarity | null {
  if (!specs) return null;
  const raw = specs.availability_rarity;
  if (typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase();
  return AVAILABILITY_RARITY_VALUES.has(key) ? (key as AvailabilityRarity) : null;
}

const AVAILABILITY_RARITY_LABEL: Record<AvailabilityRarity, string> = {
  everyday: "Everyday",
  seasonal: "Seasonal",
  allocated: "Allocated",
  lottery: "Lottery",
  "secondary-only": "Secondary only",
  discontinued: "Discontinued",
};

export function formatAvailabilityRarity(rarity: AvailabilityRarity): string {
  return AVAILABILITY_RARITY_LABEL[rarity];
}

/** Rough shelf-position bucket from allocation tier when no dollar MSRP exists. */
export function allocationTierToPriceBucket(tier: number): PriceBucket | null {
  if (!Number.isInteger(tier) || tier < 1 || tier > 5) return null;
  if (tier <= 1) return 1;
  if (tier === 2) return 2;
  if (tier === 3) return 3;
  return 4;
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
 * Bourbon: dollar MSRP, then `price_tier`, then allocation tier fallback.
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
  const priceTier = normalizeCigarPriceTier(specs);
  if (priceTier != null) return cigarPriceTierToBucket(priceTier);
  const allocTier = normalizeCobbTier(specs);
  if (allocTier != null) return allocationTierToPriceBucket(allocTier);
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
  const availability = productType === "bourbon" ? normalizeAvailabilityRarity(specs) : null;
  return {
    priceUsd: normalizePriceUsd(specs),
    cigarPriceTier: productType === "cigar" ? normalizeCigarPriceTier(specs) : null,
    priceBucket: resolvePriceBucket(productType, specs),
    cobbTier,
    rarityLabel:
      availability != null ? null : cobbTier != null ? tierToRarityLabel(cobbTier) : null,
    availabilityLabel: availability != null ? formatAvailabilityRarity(availability) : null,
  };
}

export type ConstructionRow = {
  key: string;
  label: string;
  value: string;
};

function specStr(specs: Record<string, unknown>, key: string): string | null {
  const raw = specs[key];
  if (raw === null || raw === undefined || raw === "") return null;
  const s = String(raw).trim();
  return s || null;
}

/** Loose match for catalog redundancy (Nicaraguan ↔ Nicaragua, etc.). */
export function specValuesSimilar(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  const na = a.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const nb = b.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const singleOrigin = (raw: string) => !/,|\band\b/i.test(raw);
  if (!singleOrigin(a) || !singleOrigin(b)) return false;
  let prefix = 0;
  while (prefix < na.length && prefix < nb.length && na[prefix] === nb[prefix]) prefix++;
  return prefix >= 6;
}

function formatCigarWrapper(specs: Record<string, unknown>): string | null {
  const wrapper = specStr(specs, "wrapper");
  const color = specStr(specs, "wrapper_color");
  if (!wrapper && !color) return null;
  if (wrapper && color && !specValuesSimilar(wrapper, color)) {
    return `${wrapper} · ${color}`;
  }
  return wrapper ?? color;
}

function formatCigarBlend(binder: string | null, filler: string | null): string | null {
  if (!binder && !filler) return null;
  if (binder && filler && specValuesSimilar(binder, filler)) return binder;
  if (binder && !filler) return binder;
  if (!binder && filler) return filler;
  return `${binder} binder · ${filler} filler`;
}

function formatCigarProvenance(
  country: string | null,
  factory: string | null,
  binder: string | null,
  filler: string | null,
): ConstructionRow | null {
  const showOrigin =
    country != null &&
    !specValuesSimilar(country, binder) &&
    !specValuesSimilar(country, filler);

  if (showOrigin && factory) {
    return { key: "made_in", label: "Made in", value: `${country} · ${factory}` };
  }
  if (showOrigin) {
    return { key: "made_in", label: "Made in", value: country };
  }
  if (factory) {
    return { key: "factory", label: "Factory", value: factory };
  }
  return null;
}

/** Collapsed, smoker-first construction rows for the product detail panel. */
export function buildCigarConstructionRows(
  specs: Record<string, unknown> | null | undefined,
): ConstructionRow[] {
  const s = specs ?? {};
  const rows: ConstructionRow[] = [];

  const push = (key: string, label: string, value: string | null) => {
    if (value) rows.push({ key, label, value });
  };

  push("vitola", "Vitola", specStr(s, "vitola"));
  push("size", "Size", formatCigarDimensions(s));
  push("strength", "Strength", specStr(s, "strength"));
  push("body", "Body", specStr(s, "body"));
  push("wrapper", "Wrapper", formatCigarWrapper(s));

  const binder = specStr(s, "binder");
  const filler = specStr(s, "filler");
  push("blend", "Blend", formatCigarBlend(binder, filler));

  const provenance = formatCigarProvenance(
    specStr(s, "country"),
    specStr(s, "factory"),
    binder,
    filler,
  );
  if (provenance) rows.push(provenance);

  return rows;
}

function formatBourbonProof(specs: Record<string, unknown>): string | null {
  const proof = numFromSpec(specs, "proof");
  if (proof != null) return `${proof}°`;
  const abv = numFromSpec(specs, "abv");
  if (abv != null) return `${abv}% ABV`;
  return null;
}

function formatBourbonAge(specs: Record<string, unknown>): string | null {
  const label = specStr(specs, "age_label");
  if (label) {
    if (/^NAS$/i.test(label)) return "NAS";
    if (/yr|year|month|\bmos\b/i.test(label)) return label;
    if (/^\d+(\.\d+)?$/.test(label)) return `${label} yr`;
    return label;
  }
  for (const key of ["age_years", "aging_period_years"] as const) {
    const years = numFromSpec(specs, key);
    if (years != null) return `${years} yr`;
  }
  return null;
}

function bourbonExpressionRedundant(
  expression: string,
  whiskeyType: string | null,
  productName: string | null,
): boolean {
  const ex = expression.toLowerCase();
  if (whiskeyType?.toLowerCase() === "bourbon" && ex === "straight bourbon") return true;
  if (productName && productName.toLowerCase().includes(ex)) return true;
  if (whiskeyType && specValuesSimilar(expression, whiskeyType)) return true;
  return false;
}

function formatBourbonType(
  whiskeyType: string | null,
  expression: string | null,
  productName: string | null,
): string | null {
  const showExpression =
    expression != null &&
    !bourbonExpressionRedundant(expression, whiskeyType, productName);
  if (whiskeyType && showExpression) return `${whiskeyType} · ${expression}`;
  if (whiskeyType) return whiskeyType;
  if (showExpression) return expression;
  return null;
}

/** Collapsed, drinker-first construction rows for the product detail panel. */
export function buildBourbonConstructionRows(
  specs: Record<string, unknown> | null | undefined,
  options?: { productName?: string | null },
): ConstructionRow[] {
  const s = specs ?? {};
  const rows: ConstructionRow[] = [];

  const push = (key: string, label: string, value: string | null) => {
    if (value) rows.push({ key, label, value });
  };

  push("proof", "Proof", formatBourbonProof(s));
  push("age", "Age", formatBourbonAge(s));
  push(
    "type",
    "Type",
    formatBourbonType(
      specStr(s, "whiskey_type"),
      specStr(s, "expression_type"),
      options?.productName ?? null,
    ),
  );
  push("mash_bill", "Mash bill", specStr(s, "mash_bill"));
  push("distillery", "Distillery", specStr(s, "distillery"));

  return rows;
}

/** Spec keys consumed by normalization — omit from the raw Facts strip. */
export const NORMALIZED_SPEC_KEYS = new Set([
  "price_usd",
  "msrp_usd",
  "price_tier",
  "tier",
  "tier_source",
  "tier_rationale",
  "availability_rarity",
]);
