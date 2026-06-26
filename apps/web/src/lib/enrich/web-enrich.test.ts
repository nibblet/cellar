import { describe, expect, it } from "vitest";
import { buildSearchQuery } from "./web-enrich";

describe("buildSearchQuery", () => {
  it("dedupes overlapping brand and name tokens", () => {
    expect(
      buildSearchQuery({
        id: "x",
        type: "cigar",
        brand: "Punch Rare Corojo",
        line: null,
        name: "Punch Rare Corojo Robusto",
      }),
    ).toBe("Punch Rare Corojo Robusto cigar review");
  });

  it("appends bourbon review suffix", () => {
    expect(
      buildSearchQuery({
        id: "x",
        type: "bourbon",
        brand: "Wild Turkey",
        line: null,
        name: "Rare Breed",
      }),
    ).toBe("Wild Turkey Rare Breed bourbon review tasting notes");
  });
});
