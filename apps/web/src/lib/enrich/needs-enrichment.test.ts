import { describe, expect, it } from "vitest";
import { productNeedsCatalogEnrichment } from "./needs-enrichment";

describe("productNeedsCatalogEnrichment", () => {
  it("flags AI capture with no reviews", () => {
    expect(
      productNeedsCatalogEnrichment({
        source: "ai",
        specs: { wrapper_color: "colorado (appearance)" },
        reviewCount: 0,
        hasWheelVector: false,
      }),
    ).toBe(true);
  });

  it("skips seeded catalog rows with reviews and wheel", () => {
    expect(
      productNeedsCatalogEnrichment({
        source: "seed",
        specs: { vitola: "Robusto", country: "Nicaragua" },
        reviewCount: 2,
        hasWheelVector: true,
      }),
    ).toBe(false);
  });

  it("retries specs when reviews exist but specs are still vision-only", () => {
    expect(
      productNeedsCatalogEnrichment({
        source: "ai",
        specs: { wrapper_color: "colorado (appearance)" },
        reviewCount: 3,
        hasWheelVector: true,
      }),
    ).toBe(true);
  });

  it("retries bourbon specs when reviews exist but only label-read fields are filled", () => {
    expect(
      productNeedsCatalogEnrichment({
        productType: "bourbon",
        source: "ai",
        specs: { proof: 116.8, distillery: "Wild Turkey", mash_bill: null },
        reviewCount: 3,
        hasWheelVector: true,
      }),
    ).toBe(true);
  });

  it("skips bourbon when catalog specs landed from the enrich pass", () => {
    expect(
      productNeedsCatalogEnrichment({
        productType: "bourbon",
        source: "ai",
        specs: { proof: 116.8, expression_type: "Barrel Proof", msrp_usd: 50 },
        reviewCount: 3,
        hasWheelVector: true,
      }),
    ).toBe(false);
  });
});
