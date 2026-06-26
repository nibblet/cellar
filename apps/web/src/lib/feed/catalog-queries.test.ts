import { describe, expect, it } from "vitest";
import {
  type CatalogEntry,
  type CatalogFilters,
  groupCatalogByBrand,
  passesCatalogFilters,
} from "./catalog-queries";

function entry(over: Partial<CatalogEntry> & { product_id: string }): CatalogEntry {
  return {
    name: over.product_id,
    brand: null,
    brand_family: null,
    expression: null,
    is_core_range: false,
    type: "bourbon",
    hero_image_path: null,
    catalog_image_url: null,
    matches_preferences: false,
    subtitle: null,
    ...over,
  };
}

describe("groupCatalogByBrand", () => {
  it("clusters entries by brand family", () => {
    const groups = groupCatalogByBrand([
      entry({ product_id: "kc12", brand_family: "Knob Creek" }),
      entry({ product_id: "er10", brand_family: "Eagle Rare" }),
      entry({ product_id: "kcsb", brand_family: "Knob Creek" }),
    ]);
    expect(groups.map((g) => g.brand_family)).toEqual(["Knob Creek", "Eagle Rare"]);
    expect(groups[0].entries.map((e) => e.product_id)).toEqual(["kc12", "kcsb"]);
  });

  it("orders brands by first appearance, preserving the caller's sort", () => {
    const groups = groupCatalogByBrand([
      entry({ product_id: "z", brand_family: "Zzz" }),
      entry({ product_id: "a", brand_family: "Aaa" }),
    ]);
    expect(groups.map((g) => g.brand_family)).toEqual(["Zzz", "Aaa"]);
  });

  it("floats core-range expressions to the top within a brand", () => {
    const groups = groupCatalogByBrand([
      entry({ product_id: "limited", brand_family: "Maker's Mark", is_core_range: false }),
      entry({ product_id: "core", brand_family: "Maker's Mark", is_core_range: true }),
    ]);
    expect(groups[0].entries.map((e) => e.product_id)).toEqual(["core", "limited"]);
  });

  it("collects brand-less entries into a single trailing null group", () => {
    const groups = groupCatalogByBrand([
      entry({ product_id: "cigarA", brand_family: null }),
      entry({ product_id: "kc", brand_family: "Knob Creek" }),
      entry({ product_id: "cigarB", brand_family: null }),
    ]);
    const nullGroup = groups.find((g) => g.brand_family === null);
    expect(nullGroup?.entries.map((e) => e.product_id)).toEqual(["cigarA", "cigarB"]);
  });
});

describe("passesCatalogFilters", () => {
  const baseProduct = {
    id: "p1",
    name: "Test Bourbon",
    brand: "Test",
    brand_family: null,
    expression: null,
    is_core_range: true,
    type: "bourbon" as const,
    image_url: null,
    specs: {},
    created_at: "2024-01-01",
  };

  function passes(specs: Record<string, unknown>, filters: CatalogFilters) {
    return passesCatalogFilters(baseProduct, specs, null, null, undefined, filters);
  }

  it("includes products matching availability filter", () => {
    expect(passes({ availability_rarity: "allocated" }, { availability: "allocated" })).toBe(true);
  });

  it("excludes everyday products when filtering to allocated", () => {
    expect(passes({ availability_rarity: "everyday" }, { availability: "allocated" })).toBe(false);
  });

  it("excludes products with no availability when filtering to allocated", () => {
    expect(passes({}, { availability: "allocated" })).toBe(false);
  });
});
