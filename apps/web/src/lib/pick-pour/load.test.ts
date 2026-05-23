import { describe, expect, it } from "vitest";
import { isHaveShelfPair, splitIdsByProductType } from "./load";

describe("splitIdsByProductType", () => {
  it("partitions product rows by type", () => {
    const result = splitIdsByProductType([
      { id: "c1", type: "cigar" },
      { id: "b1", type: "bourbon" },
      { id: "c2", type: "cigar" },
    ]);
    expect(result.cigars).toEqual(["c1", "c2"]);
    expect(result.bourbons).toEqual(["b1"]);
  });

  it("ignores unknown types", () => {
    const result = splitIdsByProductType([{ id: "x1", type: "other" }]);
    expect(result.cigars).toEqual([]);
    expect(result.bourbons).toEqual([]);
  });
});

describe("isHaveShelfPair", () => {
  it("requires both cigar and bourbon on Have", () => {
    const have = new Set(["c1", "b1", "b2"]);
    expect(isHaveShelfPair({ cigar_id: "c1", bourbon_id: "b1" }, have)).toBe(true);
    expect(isHaveShelfPair({ cigar_id: "c1", bourbon_id: "b9" }, have)).toBe(false);
    expect(isHaveShelfPair({ cigar_id: "c9", bourbon_id: "b1" }, have)).toBe(false);
  });
});
