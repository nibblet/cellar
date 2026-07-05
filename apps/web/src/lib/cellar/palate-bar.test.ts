import { describe, expect, it } from "vitest";
import { buildRecentPalateTraits, interleaveUniqueLabels } from "./palate-bar";

describe("interleaveUniqueLabels", () => {
  it("alternates bourbon and cigar labels while deduping case-insensitively", () => {
    expect(
      interleaveUniqueLabels(
        [
          ["Caramel", "Oak"],
          ["Vanilla"],
        ],
        [
          ["Leather", "Oak"],
          ["Char"],
        ],
      ),
    ).toEqual(["Caramel", "Oak", "Leather", "Vanilla", "Char"]);
  });
});

describe("buildRecentPalateTraits", () => {
  it("pulls top wheel labels from the last three bourbons and cigars", () => {
    const traits = buildRecentPalateTraits(
      [
        {
          product_id: "b1",
          type: "bourbon",
          wheel_vector: { caramel: 5, vanilla: 4 },
        },
        {
          product_id: "b2",
          type: "bourbon",
          wheel_vector: { oak: 5 },
        },
        {
          product_id: "c1",
          type: "cigar",
          wheel_vector: { leather: 5, cedar: 3 },
        },
      ],
      {
        bourbonIds: ["b1", "b2"],
        cigarIds: ["c1"],
      },
    );

    expect(traits).toContain("Caramel");
    expect(traits).toContain("Vanilla");
    expect(traits).toContain("Oak");
    expect(traits).toContain("Leather");
    expect(traits).toContain("Cedar");
  });

  it("returns an empty list when no recent products have wheel vectors", () => {
    expect(
      buildRecentPalateTraits(
        [{ product_id: "b1", type: "bourbon", wheel_vector: null }],
        { bourbonIds: ["b1"], cigarIds: [] },
      ),
    ).toEqual([]);
  });
});
