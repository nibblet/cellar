import { describe, expect, it } from "vitest";
import {
  cigarPriceTierToBucket,
  formatPriceBucket,
  normalizeCigarPriceTier,
  normalizePriceUsd,
  normalizeProductSpecs,
  priceUsdToBucket,
  productVisibleWithMaxCatalogTier,
  resolvePriceBucket,
  tierToRarityLabel,
} from "./normalize-specs";

describe("normalizePriceUsd", () => {
  it("prefers price_usd over msrp_usd", () => {
    expect(normalizePriceUsd({ price_usd: 40, msrp_usd: 50 })).toBe(40);
  });

  it("falls back to msrp_usd", () => {
    expect(normalizePriceUsd({ msrp_usd: 45 })).toBe(45);
  });
});

describe("normalizeCigarPriceTier", () => {
  it("accepts StickPicks ordinals 1–5", () => {
    expect(normalizeCigarPriceTier({ price_tier: 3 })).toBe(3);
  });

  it("rejects out-of-range values", () => {
    expect(normalizeCigarPriceTier({ price_tier: 6 })).toBeNull();
  });
});

describe("priceUsdToBucket — cigars", () => {
  it("maps roadmap thresholds", () => {
    expect(priceUsdToBucket(8, "cigar")).toBe(1);
    expect(priceUsdToBucket(10, "cigar")).toBe(2);
    expect(priceUsdToBucket(20, "cigar")).toBe(2);
    expect(priceUsdToBucket(25, "cigar")).toBe(3);
    expect(priceUsdToBucket(40, "cigar")).toBe(3);
    expect(priceUsdToBucket(55, "cigar")).toBe(4);
  });
});

describe("priceUsdToBucket — bourbons", () => {
  it("maps roadmap thresholds", () => {
    expect(priceUsdToBucket(30, "bourbon")).toBe(1);
    expect(priceUsdToBucket(35, "bourbon")).toBe(2);
    expect(priceUsdToBucket(60, "bourbon")).toBe(2);
    expect(priceUsdToBucket(100, "bourbon")).toBe(3);
    expect(priceUsdToBucket(200, "bourbon")).toBe(4);
  });
});

describe("cigarPriceTierToBucket", () => {
  it("maps ordinals to $…$$$$", () => {
    expect(cigarPriceTierToBucket(1)).toBe(1);
    expect(cigarPriceTierToBucket(2)).toBe(2);
    expect(cigarPriceTierToBucket(3)).toBe(3);
    expect(cigarPriceTierToBucket(4)).toBe(4);
    expect(cigarPriceTierToBucket(5)).toBe(4);
  });
});

describe("resolvePriceBucket", () => {
  it("uses price_tier for cigars without dollar price", () => {
    expect(resolvePriceBucket("cigar", { price_tier: 2 })).toBe(2);
  });

  it("prefers dollar price on cigars when both exist", () => {
    expect(resolvePriceBucket("cigar", { price_tier: 5, price_usd: 8 })).toBe(1);
  });

  it("returns null for bourbons without price", () => {
    expect(resolvePriceBucket("bourbon", { tier: 3 })).toBeNull();
  });

  it("buckets bourbons opportunistically when price exists", () => {
    expect(resolvePriceBucket("bourbon", { price_usd: 45 })).toBe(2);
  });
});

describe("formatPriceBucket", () => {
  it("renders dollar signs", () => {
    expect(formatPriceBucket(3)).toBe("$$$");
  });
});

describe("tierToRarityLabel", () => {
  it("maps tier integers to rarity buckets", () => {
    expect(tierToRarityLabel(1)).toBe("common");
    expect(tierToRarityLabel(3)).toBe("uncommon");
    expect(tierToRarityLabel(5)).toBe("rare");
    expect(tierToRarityLabel(0)).toBeNull();
  });
});

describe("productVisibleWithMaxCatalogTier", () => {
  it("hides tiers above the ceiling", () => {
    expect(productVisibleWithMaxCatalogTier({ tier: 3 }, 2)).toBe(false);
    expect(productVisibleWithMaxCatalogTier({ tier: 2 }, 2)).toBe(true);
    expect(productVisibleWithMaxCatalogTier({ tier: 5 }, 4)).toBe(false);
    expect(productVisibleWithMaxCatalogTier({}, 2)).toBe(true);
  });

  it("shows everything at tier 5", () => {
    expect(productVisibleWithMaxCatalogTier({ tier: 5 }, 5)).toBe(true);
  });
});

describe("normalizeProductSpecs", () => {
  it("returns full cigar shape", () => {
    const n = normalizeProductSpecs("cigar", { price_tier: 4 });
    expect(n.priceBucket).toBe(4);
    expect(n.cigarPriceTier).toBe(4);
    expect(n.cobbTier).toBeNull();
  });

  it("surfaces Cobb tier on bourbons without inventing price", () => {
    const n = normalizeProductSpecs("bourbon", { tier: 2, price_usd: 80 });
    expect(n.priceBucket).toBe(3);
    expect(n.cobbTier).toBe(2);
    expect(n.rarityLabel).toBe("common");
  });

  it("derives uncommon from tier 3", () => {
    const n = normalizeProductSpecs("bourbon", { tier: 3 });
    expect(n.rarityLabel).toBe("uncommon");
  });
});
