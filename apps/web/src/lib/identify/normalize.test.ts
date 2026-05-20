import { describe, expect, it } from "vitest";
import { normalizeName, pickBestMatch, trigramSimilarity } from "./normalize";

describe("normalizeName", () => {
  it("lowercases and trims", () => {
    expect(normalizeName("  Padrón  1964  ")).toBe("padron 1964");
  });

  it("strips diacritics", () => {
    expect(normalizeName("Padrón")).toBe("padron");
    expect(normalizeName("Maduro Exclusivo")).toBe("maduro exclusivo");
  });

  it("collapses punctuation and whitespace", () => {
    expect(normalizeName("Wild Turkey -- Rare Breed, 116.8")).toBe("wild turkey rare breed 116 8");
  });
});

describe("trigramSimilarity", () => {
  it("returns 1 for identical strings", () => {
    expect(trigramSimilarity("padron 1964", "padron 1964")).toBe(1);
  });

  it("returns 1 for both empty", () => {
    expect(trigramSimilarity("", "")).toBe(1);
  });

  it("returns 0 when either side is empty", () => {
    expect(trigramSimilarity("padron", "")).toBe(0);
  });

  it("scores partial overlap proportionally", () => {
    const high = trigramSimilarity("padron 1964 anniversary", "padron 1964 anniversary maduro");
    const lower = trigramSimilarity("padron 1964", "monte cristo");
    expect(high).toBeGreaterThan(0.5);
    expect(lower).toBeLessThan(0.3);
  });

  it("is order-stable", () => {
    expect(trigramSimilarity("a b c", "c b a")).toBeCloseTo(trigramSimilarity("c b a", "a b c"), 6);
  });
});

describe("pickBestMatch", () => {
  const candidates = [
    { id: "p1", name: "Padrón 1964 Anniversary Exclusivo", brand: "Padrón" },
    { id: "p2", name: "Padrón 1926 Serie No. 9", brand: "Padrón" },
    { id: "p3", name: "Wild Turkey Rare Breed", brand: "Wild Turkey" },
  ];

  it("picks the closest name when brand is shared", () => {
    const match = pickBestMatch(candidates, {
      name: "1964 Anniversary Maduro Exclusivo",
      brand: "Padron",
    });
    expect(match?.product.id).toBe("p1");
    expect(match?.matched).toBe("name+brand");
  });

  it("falls back to name-only matching when brand is missing", () => {
    const match = pickBestMatch(candidates, {
      name: "Wild Turkey Rare Breed 116.8",
      brand: null,
    });
    expect(match?.product.id).toBe("p3");
    expect(match?.matched).toBe("name");
  });

  it("returns null for an empty candidate list", () => {
    expect(pickBestMatch([], { name: "anything", brand: null })).toBeNull();
  });

  it("avoids cross-brand pollution", () => {
    const match = pickBestMatch(candidates, { name: "Padron 1926", brand: "Padron" });
    expect(match?.product.id).toBe("p2");
  });
});
