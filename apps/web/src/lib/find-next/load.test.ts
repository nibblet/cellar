import { describe, expect, it } from "vitest";
import { mergePairSuggestions, mergeProductSuggestions, pairKey } from "./load";
import type { FindNextPairSuggestion, FindNextProductSuggestion } from "./types";

describe("pairKey", () => {
  it("joins cigar and bourbon ids", () => {
    expect(pairKey("c1", "b1")).toBe("c1:b1");
  });
});

describe("mergePairSuggestions", () => {
  const cellar = (id: string): FindNextPairSuggestion => ({
    kind: "pairing",
    source: "cellar",
    cigar_id: id,
    cigar_name: `C${id}`,
    cigar_brand: null,
    bourbon_id: "b1",
    bourbon_name: "B1",
    bourbon_brand: null,
    score: 90,
    club_validated: false,
  });

  it("prefers cellar order then fills from catalog", () => {
    const catalog = cellar("c2");
    catalog.source = "catalog";
    const merged = mergePairSuggestions([cellar("c1")], [catalog], 3);
    expect(merged).toHaveLength(2);
    expect(merged[0].source).toBe("cellar");
    expect(merged[1].source).toBe("catalog");
  });

  it("dedupes identical pairs", () => {
    const dup = cellar("c1");
    dup.source = "catalog";
    const merged = mergePairSuggestions([cellar("c1")], [dup], 5);
    expect(merged).toHaveLength(1);
  });
});

describe("mergeProductSuggestions", () => {
  const product = (id: string, source: "cellar" | "catalog"): FindNextProductSuggestion => ({
    kind: "product",
    source,
    product_id: id,
    name: id,
    brand: null,
    product_type: "bourbon",
  });

  it("cellar first, catalog fills, dedupes", () => {
    const merged = mergeProductSuggestions(
      [product("a", "cellar")],
      [product("a", "catalog"), product("b", "catalog")],
      5,
    );
    expect(merged.map((p) => p.product_id)).toEqual(["a", "b"]);
    expect(merged[0].source).toBe("cellar");
  });
});
