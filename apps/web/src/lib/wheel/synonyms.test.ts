import { describe, expect, it } from "vitest";
import { buildSynonymIndex, matchChip } from "./synonyms";

describe("buildSynonymIndex", () => {
  it("indexes every leaf's label", () => {
    const index = buildSynonymIndex("cigar");
    expect(index.get("cedar")).toBe("cedar");
    expect(index.get("leather")).toBe("leather");
    expect(index.get("cocoa")).toBe("cocoa");
  });

  it("maps known synonyms to the canonical leaf id", () => {
    const index = buildSynonymIndex("cigar");
    expect(index.get("barnyard")).toBe("hay");
    expect(index.get("espresso")).toBe("coffee");
    expect(index.get("peppercorn")).toBe("black-pepper");
    expect(index.get("forest floor")).toBe("soil");
  });

  it("normalizes case and whitespace", () => {
    const index = buildSynonymIndex("cigar");
    expect(index.get("BARNYARD".toLowerCase())).toBe("hay");
  });

  it("works for bourbon too", () => {
    const index = buildSynonymIndex("bourbon");
    expect(index.get("vanilla")).toBe("vanilla");
    expect(index.get("demerara")).toBe("brown-sugar");
    expect(index.get("barrel char")).toBe("charred-oak");
  });
});

describe("matchChip", () => {
  it("returns leaf id for an exact label", () => {
    const index = buildSynonymIndex("cigar");
    expect(matchChip(index, "leather")).toBe("leather");
  });

  it("returns leaf id for a synonym", () => {
    const index = buildSynonymIndex("cigar");
    expect(matchChip(index, "  Barnyard  ")).toBe("hay");
  });

  it("returns null for unknown chips", () => {
    const index = buildSynonymIndex("cigar");
    expect(matchChip(index, "elderflower")).toBeNull();
    expect(matchChip(index, "")).toBeNull();
  });
});
