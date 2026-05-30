import { describe, expect, it } from "vitest";
import {
  applyTierPriceFilter,
  readPriceUsd,
  readTier,
  withinPriceBand,
  withinTierBand,
} from "./suggest-adjacent";

describe("readTier", () => {
  it("returns tier when present and in range", () => {
    expect(readTier({ tier: 2 })).toBe(2);
  });

  it("returns null for missing or invalid tier", () => {
    expect(readTier(null)).toBeNull();
    expect(readTier({ tier: 0 })).toBeNull();
    expect(readTier({ tier: "2" })).toBeNull();
  });
});

describe("readPriceUsd", () => {
  it("returns positive price_usd", () => {
    expect(readPriceUsd({ price_usd: 45 })).toBe(45);
  });

  it("returns null for missing or non-positive price", () => {
    expect(readPriceUsd(null)).toBeNull();
    expect(readPriceUsd({ price_usd: 0 })).toBeNull();
  });
});

describe("withinTierBand", () => {
  it("passes when either tier is unknown", () => {
    expect(withinTierBand(null, 3, 1)).toBe(true);
    expect(withinTierBand(2, null, 1)).toBe(true);
  });

  it("respects tier band", () => {
    expect(withinTierBand(2, 3, 1)).toBe(true);
    expect(withinTierBand(2, 4, 1)).toBe(false);
  });
});

describe("withinPriceBand", () => {
  it("passes when either price is unknown", () => {
    expect(withinPriceBand(null, 50, 0.35)).toBe(true);
    expect(withinPriceBand(100, null, 0.35)).toBe(true);
  });

  it("respects price band percentage", () => {
    expect(withinPriceBand(100, 120, 0.35)).toBe(true);
    expect(withinPriceBand(100, 200, 0.35)).toBe(false);
  });
});

describe("applyTierPriceFilter", () => {
  const scored = [
    {
      product_id: "a",
      name: "A",
      brand: null,
      similarity: 0.9,
      tier: 2,
      price_usd: 50,
    },
    {
      product_id: "b",
      name: "B",
      brand: null,
      similarity: 0.85,
      tier: 4,
      price_usd: 200,
    },
    {
      product_id: "c",
      name: "C",
      brand: null,
      similarity: 0.8,
      tier: 2,
      price_usd: 55,
    },
  ];

  it("returns top N without filtering when matchTier is false", () => {
    const result = applyTierPriceFilter(scored, 2, 50, {
      tierBand: 1,
      priceBandPct: 0.35,
      matchTier: false,
      limit: 2,
    });
    expect(result.map((r) => r.product_id)).toEqual(["a", "b"]);
  });

  it("filters by tier band and relaxes when too few matches", () => {
    const strict = applyTierPriceFilter(scored, 2, 50, {
      tierBand: 0,
      priceBandPct: 0.1,
      matchTier: true,
      limit: 2,
    });
    expect(strict.every((r) => r.tier === 2 || r.tier === null)).toBe(true);
  });
});
