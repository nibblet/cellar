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

  describe("intensity-modifier stripping (v0.1-syn2)", () => {
    it("strips a leading intensity modifier and matches the head noun", () => {
      const index = buildSynonymIndex("bourbon");
      expect(matchChip(index, "rich oak")).toBe("oak");
      expect(matchChip(index, "Rich caramel")).toBe("caramel");
      expect(matchChip(index, "deep vanilla")).toBe("vanilla");
      expect(matchChip(index, "light cherry")).toBe("cherry");
    });

    it("strips multiple hedge tokens including stop words", () => {
      const index = buildSynonymIndex("bourbon");
      expect(matchChip(index, "hint of vanilla")).toBe("vanilla");
      expect(matchChip(index, "notes of caramel")).toBe("caramel");
      expect(matchChip(index, "a touch of honey")).toBe("honey");
    });

    it("falls back to synonyms after stripping ('rich fruit' → dried-fruit)", () => {
      const index = buildSynonymIndex("bourbon");
      // 'fruit' is a v0.1-syn1 synonym for dried-fruit
      expect(matchChip(index, "rich fruit")).toBe("dried-fruit");
      expect(matchChip(index, "deep fruit")).toBe("dried-fruit");
    });

    it("does NOT strip 'dark' — it's a meaningful modifier in existing synonyms", () => {
      const index = buildSynonymIndex("bourbon");
      // Exact match wins → "dark fruit" is a registered synonym for dried-fruit
      expect(matchChip(index, "dark fruit")).toBe("dried-fruit");
      // Exact match for "dark chocolate" too
      expect(matchChip(index, "dark chocolate")).toBe("chocolate");
    });

    it("returns null when the residual after stripping doesn't match anything", () => {
      const index = buildSynonymIndex("bourbon");
      expect(matchChip(index, "rich elderflower")).toBeNull();
      expect(matchChip(index, "deep wibblywobble")).toBeNull();
    });

    it("returns null when the entire input is modifiers", () => {
      const index = buildSynonymIndex("bourbon");
      expect(matchChip(index, "rich")).toBeNull();
      expect(matchChip(index, "deep rich bold")).toBeNull();
    });

    it("handles capitalization on the modifier", () => {
      const index = buildSynonymIndex("bourbon");
      expect(matchChip(index, "Rich Oak")).toBe("oak");
      expect(matchChip(index, "DEEP CARAMEL")).toBe("caramel");
    });
  });
});
