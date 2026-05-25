import { describe, expect, it } from "vitest";
import {
  allocationTierToPriceBucket,
  buildBourbonConstructionRows,
  buildCigarConstructionRows,
  cigarPriceTierToBucket,
  formatAvailabilityRarity,
  formatCigarDimensions,
  formatPriceBucket,
  normalizeAvailabilityRarity,
  normalizeCigarPriceTier,
  normalizePriceUsd,
  normalizeProductSpecs,
  priceUsdToBucket,
  productVisibleWithMaxCatalogTier,
  resolvePriceBucket,
  specValuesSimilar,
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

  it("returns null for bourbons without price or tier", () => {
    expect(resolvePriceBucket("bourbon", {})).toBeNull();
  });

  it("falls back to allocation tier for bourbons without dollar price", () => {
    expect(resolvePriceBucket("bourbon", { tier: 3 })).toBe(3);
    expect(resolvePriceBucket("bourbon", { tier: 1 })).toBe(1);
    expect(resolvePriceBucket("bourbon", { tier: 5 })).toBe(4);
  });

  it("prefers dollar price over tier on bourbons", () => {
    expect(resolvePriceBucket("bourbon", { tier: 5, price_usd: 30 })).toBe(1);
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

  it("prefers availability_rarity over tier-derived rarity", () => {
    const n = normalizeProductSpecs("bourbon", {
      tier: 5,
      availability_rarity: "allocated",
    });
    expect(n.availabilityLabel).toBe("Allocated");
    expect(n.rarityLabel).toBeNull();
  });
});

describe("normalizeAvailabilityRarity", () => {
  it("accepts curated availability values", () => {
    expect(normalizeAvailabilityRarity({ availability_rarity: "lottery" })).toBe("lottery");
  });

  it("rejects unknown values", () => {
    expect(normalizeAvailabilityRarity({ availability_rarity: "mythical" })).toBeNull();
  });
});

describe("formatAvailabilityRarity", () => {
  it("formats secondary-only with a space", () => {
    expect(formatAvailabilityRarity("secondary-only")).toBe("Secondary only");
  });
});

describe("allocationTierToPriceBucket", () => {
  it("maps allocation tiers to price buckets", () => {
    expect(allocationTierToPriceBucket(1)).toBe(1);
    expect(allocationTierToPriceBucket(3)).toBe(3);
    expect(allocationTierToPriceBucket(5)).toBe(4);
  });
});

describe("specValuesSimilar", () => {
  it("matches country adjectives to country names", () => {
    expect(specValuesSimilar("Nicaraguan", "Nicaragua")).toBe(true);
    expect(specValuesSimilar("Honduran", "Honduras")).toBe(true);
  });
});

describe("buildCigarConstructionRows", () => {
  it("collapses redundant Perdomo-style construction fields", () => {
    const rows = buildCigarConstructionRows({
      wrapper: "Connecticut Shade",
      wrapper_color: "Connecticut Shade",
      binder: "Nicaraguan",
      filler: "Nicaraguan",
      country: "Nicaragua",
      factory: "Tabacalera Perdomo S.A. (Nicaragua)",
      vitola: "Robusto",
      length_inches: 5,
      ring_gauge: 54,
      strength: "mild-medium",
      body: "medium-full",
    });

    expect(rows.map((r) => r.label)).toEqual([
      "Vitola",
      "Size",
      "Strength",
      "Body",
      "Wrapper",
      "Blend",
      "Factory",
    ]);
    expect(rows.find((r) => r.key === "wrapper")?.value).toBe("Connecticut Shade");
    expect(rows.find((r) => r.key === "blend")?.value).toBe("Nicaraguan");
    expect(rows.some((r) => r.label === "Made in")).toBe(false);
    expect(rows.find((r) => r.key === "factory")?.value).toBe(
      "Tabacalera Perdomo S.A. (Nicaragua)",
    );
  });

  it("combines wrapper leaf and shade when they differ", () => {
    const rows = buildCigarConstructionRows({
      wrapper: "Habano",
      wrapper_color: "Colorado",
    });
    expect(rows.find((r) => r.key === "wrapper")?.value).toBe("Habano · Colorado");
  });

  it("expands blend when binder and filler differ meaningfully", () => {
    const rows = buildCigarConstructionRows({
      binder: "Indonesian",
      filler: "Dominican, Honduran, Nicaraguan",
    });
    expect(rows.find((r) => r.key === "blend")?.value).toBe(
      "Indonesian binder · Dominican, Honduran, Nicaraguan filler",
    );
  });

  it("shows made in when origin adds information beyond the blend", () => {
    const rows = buildCigarConstructionRows({
      binder: "Nicaraguan",
      filler: "Nicaraguan",
      country: "Dominican Republic",
      factory: "La Aurora",
    });
    expect(rows.find((r) => r.key === "made_in")?.value).toBe(
      "Dominican Republic · La Aurora",
    );
    expect(rows.some((r) => r.key === "factory")).toBe(false);
  });

  it("shows made in alone when factory is absent", () => {
    const rows = buildCigarConstructionRows({
      binder: "Nicaraguan",
      filler: "Dominican, Nicaraguan",
      country: "Dominican Republic",
    });
    expect(rows.find((r) => r.key === "made_in")?.value).toBe("Dominican Republic");
  });
});

describe("buildBourbonConstructionRows", () => {
  it("renders drinker-first collapsed rows for a cask-strength rye", () => {
    const rows = buildBourbonConstructionRows(
      {
        distillery: "Louisville Distilling Co.",
        whiskey_type: "Rye",
        expression_type: "Cask Strength",
        mash_bill: "72% corn, 18% rye, 10% malted barley",
        proof: 119.2,
        abv: 59.6,
        age_label: "6",
      },
      { productName: "Angel's Envy Rye Cask Strength" },
    );

    expect(rows.map((r) => r.label)).toEqual([
      "Proof",
      "Age",
      "Type",
      "Mash bill",
      "Distillery",
    ]);
    expect(rows.find((r) => r.key === "proof")?.value).toBe("119.2°");
    expect(rows.find((r) => r.key === "age")?.value).toBe("6 yr");
    expect(rows.find((r) => r.key === "type")?.value).toBe("Rye");
    expect(rows.some((r) => r.value.includes("ABV"))).toBe(false);
  });

  it("falls back to ABV when proof is missing", () => {
    const rows = buildBourbonConstructionRows({ abv: 45 });
    expect(rows.find((r) => r.key === "proof")?.value).toBe("45% ABV");
  });

  it("combines whiskey type and additive expression", () => {
    const rows = buildBourbonConstructionRows({
      whiskey_type: "Bourbon",
      expression_type: "Single Barrel",
    });
    expect(rows.find((r) => r.key === "type")?.value).toBe("Bourbon · Single Barrel");
  });

  it("drops straight bourbon expression when type is already bourbon", () => {
    const rows = buildBourbonConstructionRows({
      whiskey_type: "Bourbon",
      expression_type: "Straight Bourbon",
    });
    expect(rows.find((r) => r.key === "type")?.value).toBe("Bourbon");
  });

  it("formats numeric age labels and age_years fallback", () => {
    expect(buildBourbonConstructionRows({ age_label: "12 yr" }).find((r) => r.key === "age")?.value).toBe(
      "12 yr",
    );
    expect(buildBourbonConstructionRows({ age_years: 8 }).find((r) => r.key === "age")?.value).toBe(
      "8 yr",
    );
  });
});

describe("formatCigarDimensions", () => {
  it("combines length_inches and ring_gauge", () => {
    expect(formatCigarDimensions({ length_inches: 5.5, ring_gauge: 50 })).toBe('5.5" × 50');
  });

  it("falls back to length key from older seeders", () => {
    expect(formatCigarDimensions({ length: 6, ring_gauge: 52 })).toBe('6" × 52');
  });

  it("coerces string ring_gauge", () => {
    expect(formatCigarDimensions({ length_inches: 6.125, ring_gauge: "54" })).toBe('6.125" × 54');
  });

  it("renders either side independently", () => {
    expect(formatCigarDimensions({ length_inches: 7 })).toBe('7"');
    expect(formatCigarDimensions({ ring_gauge: 48 })).toBe("48");
  });

  it("prefers explicit dimension string", () => {
    expect(formatCigarDimensions({ dimension: '6" × 52', length_inches: 5.5 })).toBe('6" × 52');
  });
});
