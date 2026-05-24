import { describe, expect, it } from "vitest";
import { formatRarityLabel, tierToRarityLabel } from "@/lib/catalog/normalize-specs";
import {
  buildTierClassifierPayload,
  mergeTierIntoSpecs,
  shouldSkipTierEnrichment,
} from "./bourbon-tier";

describe("tierToRarityLabel", () => {
  it("maps Cobb scale to rarity buckets", () => {
    expect(tierToRarityLabel(1)).toBe("common");
    expect(tierToRarityLabel(2)).toBe("common");
    expect(tierToRarityLabel(3)).toBe("uncommon");
    expect(tierToRarityLabel(4)).toBe("rare");
    expect(tierToRarityLabel(5)).toBe("rare");
  });

  it("rejects invalid tiers", () => {
    expect(tierToRarityLabel(0)).toBeNull();
    expect(tierToRarityLabel(6)).toBeNull();
    expect(tierToRarityLabel(2.5)).toBeNull();
  });
});

describe("formatRarityLabel", () => {
  it("title-cases for display", () => {
    expect(formatRarityLabel("uncommon")).toBe("Uncommon");
  });
});

describe("shouldSkipTierEnrichment", () => {
  it("never touches manual tiers", () => {
    expect(shouldSkipTierEnrichment({ tier: 3, tier_source: "manual" }, false)).toBe(
      "tier_source_manual",
    );
  });

  it("never re-classifies llm tiers unless forced", () => {
    expect(shouldSkipTierEnrichment({ tier: 2, tier_source: "llm" }, false)).toBe(
      "tier_source_llm",
    );
    expect(shouldSkipTierEnrichment({ tier: 2, tier_source: "llm" }, true)).toBeNull();
  });

  it("enriches Cobb collection rows even when tier is already set", () => {
    expect(shouldSkipTierEnrichment({ tier: 2, in_cobb_collection: true }, false)).toBeNull();
    expect(shouldSkipTierEnrichment({ tier: 4, tier_source: "cobb" }, false)).toBeNull();
  });

  it("skips orphan tier without source unless forced", () => {
    expect(shouldSkipTierEnrichment({ tier: 3 }, false)).toBe("tier_exists_no_source");
    expect(shouldSkipTierEnrichment({ tier: 3 }, true)).toBeNull();
  });

  it("enriches rows with no tier", () => {
    expect(shouldSkipTierEnrichment({}, false)).toBeNull();
    expect(shouldSkipTierEnrichment({ distillery: "Buffalo Trace" }, false)).toBeNull();
  });
});

describe("mergeTierIntoSpecs", () => {
  it("writes llm tier fields without dropping existing specs", () => {
    const merged = mergeTierIntoSpecs(
      { distillery: "Buffalo Trace", proof: 90 },
      { tier: 2, rationale: "Shelf staple." },
    );
    expect(merged).toEqual({
      distillery: "Buffalo Trace",
      proof: 90,
      tier: 2,
      tier_source: "llm",
      tier_rationale: "Shelf staple.",
    });
  });
});

describe("buildTierClassifierPayload", () => {
  it("includes identity fields only", () => {
    const payload = buildTierClassifierPayload({
      name: "Buffalo Trace Kentucky Straight Bourbon",
      brand: "Buffalo Trace",
      specs: {
        distillery: "Buffalo Trace",
        proof: 90,
        age_years: null,
        tier: 99,
        price_usd: 30,
      },
    });
    expect(payload.name).toBe("Buffalo Trace Kentucky Straight Bourbon");
    expect(payload.distillery).toBe("Buffalo Trace");
    expect(payload.proof).toBe(90);
    expect(payload).not.toHaveProperty("tier");
    expect(payload).not.toHaveProperty("price_usd");
  });
});
