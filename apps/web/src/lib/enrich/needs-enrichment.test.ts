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
});
