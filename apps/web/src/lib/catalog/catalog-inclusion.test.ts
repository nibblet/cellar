import { describe, expect, it } from "vitest";
import {
  groupIncludedByBrand,
  type IncludedRow,
  normalizeExpressionKey,
} from "./catalog-inclusion";

function row(over: Partial<IncludedRow> & { id: string }): IncludedRow {
  return { name: over.id, brand: null, brand_family: null, expression: null, ...over };
}

describe("normalizeExpressionKey", () => {
  it("collapses the same bottle across differing source names", () => {
    // Cobb row vs bourbonExplorer row for the same Barrell bottle.
    const a = normalizeExpressionKey("Barrell Craft", "Barrell Craft Barrell Seagrass");
    const b = normalizeExpressionKey("Barrell Craft", "Barrell Craft Spirits Seagrass Rye");
    expect(a).toBe("seagrass");
    expect(b).toBe("seagrass");
  });

  it("keeps genuinely different expressions apart", () => {
    expect(normalizeExpressionKey("Knob Creek", "Knob Creek 12 Year")).not.toBe(
      normalizeExpressionKey("Knob Creek", "Knob Creek Single Barrel Select"),
    );
  });
});

describe("groupIncludedByBrand", () => {
  it("flags colliding rows within a brand as possible duplicates", () => {
    const groups = groupIncludedByBrand([
      row({
        id: "seagrass-cobb",
        brand_family: "Barrell Craft",
        expression: "Barrell Craft Barrell Seagrass",
      }),
      row({
        id: "seagrass-bx",
        brand_family: "Barrell Craft",
        expression: "Barrell Craft Spirits Seagrass Rye",
      }),
      row({ id: "dovetail", brand_family: "Barrell Craft", expression: "Barrell Craft Dovetail" }),
    ]);
    const barrell = groups.find((g) => g.brand_family === "Barrell Craft");
    expect(barrell?.dupeCount).toBe(2);
    expect(barrell?.rows.find((r) => r.id === "seagrass-cobb")?.possibleDupe).toBe(true);
    expect(barrell?.rows.find((r) => r.id === "seagrass-bx")?.possibleDupe).toBe(true);
    expect(barrell?.rows.find((r) => r.id === "dovetail")?.possibleDupe).toBe(false);
  });

  it("sorts brands with duplicates first", () => {
    const groups = groupIncludedByBrand([
      row({ id: "a", brand_family: "Clean Brand", expression: "Clean Brand Flagship" }),
      row({ id: "b", brand_family: "Dupe Brand", expression: "Dupe Brand Seagrass" }),
      row({ id: "c", brand_family: "Dupe Brand", expression: "Dupe Brand Spirits Seagrass" }),
    ]);
    expect(groups[0].brand_family).toBe("Dupe Brand");
  });

  it("skips rows without a brand family", () => {
    const groups = groupIncludedByBrand([
      row({ id: "x", brand_family: null, expression: "Whatever" }),
    ]);
    expect(groups).toHaveLength(0);
  });
});
