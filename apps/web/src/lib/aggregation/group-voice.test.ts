import { describe, expect, it } from "vitest";
import { buildTagCloud } from "./group-voice";

describe("buildTagCloud", () => {
  it("returns empty when there are no tastings", () => {
    expect(buildTagCloud("cigar", [])).toEqual([]);
  });

  it("ignores leaves with score < 1", () => {
    const result = buildTagCloud("cigar", [{ cocoa: 5, leather: 0 }, { cocoa: 4 }]);
    expect(result.find((e) => e.leaf_id === "leather")).toBeUndefined();
    expect(result.find((e) => e.leaf_id === "cocoa")?.mentions).toBe(2);
  });

  it("ranks by summed intensity, ties broken by mentions", () => {
    const result = buildTagCloud("cigar", [
      { cocoa: 5, leather: 4 },
      { cocoa: 5 },
      { leather: 5 }, // leather total = 9
    ]);
    // cocoa total = 10 (mentions 2), leather total = 9 (mentions 2)
    expect(result[0].leaf_id).toBe("cocoa");
    expect(result[1].leaf_id).toBe("leather");
  });

  it("normalizes the top entry to score 1.0", () => {
    const result = buildTagCloud("cigar", [{ cocoa: 5, leather: 3, "black-pepper": 1 }]);
    expect(result[0].score).toBe(1);
    expect(result[1].score).toBeCloseTo(3 / 5, 6);
    expect(result[2].score).toBeCloseTo(1 / 5, 6);
  });

  it("limits results to maxEntries", () => {
    const result = buildTagCloud(
      "cigar",
      [
        {
          cocoa: 5,
          leather: 5,
          "black-pepper": 5,
          cedar: 5,
          coffee: 5,
          hay: 5,
          vanilla: 5,
          soil: 5,
          musk: 5,
        },
      ],
      4,
    );
    expect(result.length).toBe(4);
  });

  it("resolves leaf labels from the wheel", () => {
    const result = buildTagCloud("bourbon", [{ "charred-oak": 5 }]);
    expect(result[0].label).toBe("charred oak");
  });

  it("survives unknown leaf ids (uses id as label fallback)", () => {
    const result = buildTagCloud("cigar", [{ "made-up-leaf": 5 }]);
    expect(result[0].label).toBe("made-up-leaf");
  });

  it("scales across many tastings", () => {
    // 12 members, half scored leather=4, the other half cocoa=3 → leather wins
    const tastings = [...Array(6).fill({ leather: 4 }), ...Array(6).fill({ cocoa: 3 })];
    const result = buildTagCloud("cigar", tastings);
    expect(result[0].leaf_id).toBe("leather");
    expect(result[0].mentions).toBe(6);
  });
});
