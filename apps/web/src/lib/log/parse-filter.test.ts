import { describe, expect, it } from "vitest";
import { parseLogFilter } from "./parse-filter";

describe("parseLogFilter", () => {
  it("defaults to all", () => {
    expect(parseLogFilter(undefined)).toBe("all");
    expect(parseLogFilter("")).toBe("all");
  });

  it("accepts tastings and pairings", () => {
    expect(parseLogFilter("tastings")).toBe("tastings");
    expect(parseLogFilter("pairings")).toBe("pairings");
  });
});
