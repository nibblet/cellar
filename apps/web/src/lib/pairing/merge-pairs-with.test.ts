import { describe, expect, it } from "vitest";
import type { PairingCandidate } from "./engine";
import { mergePairsWith } from "./merge-pairs-with";

function candidate(id: string): PairingCandidate {
  return {
    product_id: id,
    name: id,
    brand: null,
    type: "bourbon",
    score: 70,
    reasons: [],
  };
}

describe("mergePairsWith", () => {
  it("puts shelf first and tags source cellar", () => {
    const merged = mergePairsWith(candidate("shelf"), [candidate("cat1")]);
    expect(merged).toHaveLength(2);
    expect(merged[0]?.source).toBe("cellar");
    expect(merged[0]?.product_id).toBe("shelf");
    expect(merged[1]?.source).toBe("catalog");
  });

  it("dedupes catalog when shelf pick is also in catalog top 3", () => {
    const merged = mergePairsWith(candidate("dup"), [candidate("dup"), candidate("other")]);
    expect(merged).toHaveLength(2);
    expect(merged[0]?.source).toBe("cellar");
    expect(merged.map((r) => r.product_id)).toEqual(["dup", "other"]);
  });

  it("returns catalog-only when shelf is null", () => {
    const merged = mergePairsWith(null, [candidate("a"), candidate("b")]);
    expect(merged.every((r) => r.source === "catalog")).toBe(true);
    expect(merged).toHaveLength(2);
  });

  it("caps catalog rows at three", () => {
    const merged = mergePairsWith(null, [
      candidate("1"),
      candidate("2"),
      candidate("3"),
      candidate("4"),
    ]);
    expect(merged).toHaveLength(3);
  });
});
