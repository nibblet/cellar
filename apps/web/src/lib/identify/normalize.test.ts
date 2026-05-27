import { describe, expect, it } from "vitest";
import { normalizeName, pickBestMatch, stripReleaseNoise, trigramSimilarity } from "./normalize";

describe("stripReleaseNoise", () => {
  it("removes pick / batch / barrel-code noise", () => {
    expect(stripReleaseNoise("Single Barrel Select Store Pick Barrel #3405")).toBe(
      "Single Barrel Select",
    );
    expect(stripReleaseNoise("Barrel Proof Batch C923")).toBe("Barrel Proof");
    expect(stripReleaseNoise("Single Barrel Private Selection")).toBe("Single Barrel");
    expect(stripReleaseNoise("Single Barrel No. 3403")).toBe("Single Barrel");
  });

  it("preserves expression words, ages, and year-named expressions", () => {
    expect(stripReleaseNoise("Single Barrel Select")).toBe("Single Barrel Select");
    expect(stripReleaseNoise("Barrel Proof")).toBe("Barrel Proof");
    expect(stripReleaseNoise("12 Year")).toBe("12 Year");
    expect(stripReleaseNoise("1920 Prohibition Style")).toBe("1920 Prohibition Style");
  });
});

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

  it("matches collapsed bourbon expressions after stripping brand prefix", () => {
    const bourbons = [
      { id: "b1", name: "Fusion Series", brand: "Bardstown" },
      { id: "b2", name: "Rare Breed", brand: "Wild Turkey" },
    ];
    const match = pickBestMatch(bourbons, {
      name: "Bardstown Fusion Series",
      brand: "Bardstown Bourbon Company",
    });
    expect(match?.product.id).toBe("b1");
  });

  it("matches a store pick to its primary expression", () => {
    const bourbons = [
      { id: "kc-sbs", name: "Knob Creek Single Barrel Select", brand: "Knob Creek" },
      { id: "kc-sb", name: "Knob Creek Small Batch", brand: "Knob Creek" },
    ];
    const match = pickBestMatch(bourbons, {
      name: "Knob Creek Single Barrel Select Store Pick Barrel #3405",
      brand: "Knob Creek",
    });
    expect(match?.product.id).toBe("kc-sbs");
  });

  it("returns null for an empty candidate list", () => {
    expect(pickBestMatch([], { name: "anything", brand: null })).toBeNull();
  });

  it("avoids cross-brand pollution", () => {
    const match = pickBestMatch(candidates, { name: "Padron 1926", brand: "Padron" });
    expect(match?.product.id).toBe("p2");
  });
});
