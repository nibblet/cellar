import { describe, expect, it } from "vitest";
import { normalizeExpressionType } from "./normalize-expression-type";

describe("normalizeExpressionType", () => {
  it("passes through a single token", () => {
    expect(normalizeExpressionType("Single Barrel")).toEqual({
      expression_type: "Single Barrel",
      expression_modifier: null,
      needs_review: false,
    });
  });

  it("picks series token from comma list", () => {
    expect(normalizeExpressionType("Small Batch, Straight Bourbon")).toEqual({
      expression_type: "Small Batch",
      expression_modifier: "Straight Bourbon",
      needs_review: false,
    });
  });

  it("handles barrel strength + single barrel", () => {
    const result = normalizeExpressionType("Barrel Strength, Single Barrel");
    expect(result.expression_type).toBe("Single Barrel");
    expect(result.expression_modifier).toBe("Barrel Strength");
  });

  it("flags finish-only compound strings for review", () => {
    const result = normalizeExpressionType("Madeira Finished, Cask Finished");
    expect(result.expression_type).toBeNull();
    expect(result.expression_modifier).toContain("Madeira");
    expect(result.needs_review).toBe(true);
  });
});
