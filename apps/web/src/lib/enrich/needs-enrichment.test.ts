import { describe, expect, it } from "vitest";
import { isCatalogWebEnriched, productNeedsCatalogEnrichment } from "./needs-enrichment";

describe("isCatalogWebEnriched", () => {
  it("treats legacy product_reviews rows as enriched", () => {
    expect(isCatalogWebEnriched({}, 2)).toBe(true);
  });

  it("treats web_enriched_at as enriched", () => {
    expect(isCatalogWebEnriched({ web_enriched_at: "2026-06-24T00:00:00Z" }, 0)).toBe(true);
  });
});

describe("productNeedsCatalogEnrichment", () => {
  it("flags AI capture with no web enrichment", () => {
    expect(
      productNeedsCatalogEnrichment({
        source: "ai",
        specs: { wrapper_color: "colorado (appearance)" },
        reviewCount: 0,
        hasWheelVector: false,
      }),
    ).toBe(true);
  });

  it("skips after OpenAI web enrich landed specs and wheel", () => {
    expect(
      productNeedsCatalogEnrichment({
        productType: "bourbon",
        source: "ai",
        specs: {
          web_enriched_at: "2026-06-24T00:00:00Z",
          proof: 116.8,
          expression_type: "Barrel Proof",
          msrp_usd: 50,
        },
        reviewCount: 0,
        hasWheelVector: true,
      }),
    ).toBe(false);
  });

  it("skips seeded catalog rows with legacy reviews and wheel", () => {
    expect(
      productNeedsCatalogEnrichment({
        source: "seed",
        specs: { vitola: "Robusto", country: "Nicaragua" },
        reviewCount: 2,
        hasWheelVector: true,
      }),
    ).toBe(false);
  });

  it("retries specs when enriched but specs are still vision-only", () => {
    expect(
      productNeedsCatalogEnrichment({
        source: "ai",
        specs: {
          web_enriched_at: "2026-06-24T00:00:00Z",
          wrapper_color: "colorado (appearance)",
        },
        reviewCount: 0,
        hasWheelVector: true,
      }),
    ).toBe(true);
  });

  it("does not retry wheel when OpenAI web enrich already ran", () => {
    expect(
      productNeedsCatalogEnrichment({
        productType: "bourbon",
        source: "ai",
        specs: {
          web_enriched_at: "2026-06-24T00:00:00Z",
          proof: 100,
          expression_type: "Small Batch",
        },
        reviewCount: 0,
        hasWheelVector: false,
      }),
    ).toBe(false);
  });

  it("retries legacy review rows missing wheel", () => {
    expect(
      productNeedsCatalogEnrichment({
        productType: "bourbon",
        source: "seed",
        specs: { proof: 100, expression_type: "Small Batch" },
        reviewCount: 2,
        hasWheelVector: false,
      }),
    ).toBe(true);
  });

  it("retries bourbon specs when enriched but only label-read fields are filled", () => {
    expect(
      productNeedsCatalogEnrichment({
        productType: "bourbon",
        source: "ai",
        specs: {
          web_enriched_at: "2026-06-24T00:00:00Z",
          proof: 116.8,
          distillery: "Wild Turkey",
          mash_bill: null,
        },
        reviewCount: 0,
        hasWheelVector: true,
      }),
    ).toBe(true);
  });
});
