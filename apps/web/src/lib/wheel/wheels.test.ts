import { describe, expect, it } from "vitest";
import { getLeaf, getWheel } from "./wheels";

describe("getWheel", () => {
  it("returns the cigar wheel with expected version", () => {
    const wheel = getWheel("cigar");
    expect(wheel.type).toBe("cigar");
    expect(wheel.version).toBe("0.1");
    expect(wheel.categories.length).toBeGreaterThanOrEqual(8);
    expect(wheel.leaves.length).toBeGreaterThanOrEqual(35);
  });

  it("returns the bourbon wheel with expected version", () => {
    const wheel = getWheel("bourbon");
    expect(wheel.type).toBe("bourbon");
    expect(wheel.version).toBe("0.1");
    expect(wheel.categories.length).toBeGreaterThanOrEqual(6);
    expect(wheel.leaves.length).toBeGreaterThanOrEqual(35);
  });

  it("every cigar leaf references a known category", () => {
    const wheel = getWheel("cigar");
    const categoryIds = new Set(wheel.categories.map((c) => c.id));
    for (const leaf of wheel.leaves) {
      expect(categoryIds.has(leaf.category_id)).toBe(true);
    }
  });

  it("every bourbon leaf references a known category", () => {
    const wheel = getWheel("bourbon");
    const categoryIds = new Set(wheel.categories.map((c) => c.id));
    for (const leaf of wheel.leaves) {
      expect(categoryIds.has(leaf.category_id)).toBe(true);
    }
  });
});

describe("getLeaf", () => {
  it("finds known cigar leaves", () => {
    expect(getLeaf("cigar", "cedar").label).toBe("cedar");
    expect(getLeaf("cigar", "leather").label).toBe("leather");
  });

  it("finds known bourbon leaves", () => {
    expect(getLeaf("bourbon", "vanilla").label).toBe("vanilla");
    expect(getLeaf("bourbon", "charred-oak").label).toBe("charred oak");
  });

  it("throws on unknown leaf id", () => {
    expect(() => getLeaf("cigar", "not-a-real-leaf")).toThrow(/Unknown leaf id/);
  });
});
