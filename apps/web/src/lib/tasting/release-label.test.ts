import { describe, expect, it } from "vitest";
import { parseReleaseLabel, releasePatternPrompt } from "./release-label";

describe("parseReleaseLabel", () => {
  it("returns nulls for empty input", () => {
    expect(parseReleaseLabel(null)).toEqual({ release_label: null, release_year: null });
    expect(parseReleaseLabel("  ")).toEqual({ release_label: null, release_year: null });
  });

  it("extracts four-digit years", () => {
    expect(parseReleaseLabel("2021")).toEqual({ release_label: "2021", release_year: 2021 });
    expect(parseReleaseLabel("Old Forester Birthday 2020")).toEqual({
      release_label: "Old Forester Birthday 2020",
      release_year: 2020,
    });
  });

  it("normalizes two-digit years", () => {
    expect(parseReleaseLabel("21")).toEqual({ release_label: "21", release_year: 2021 });
    expect(parseReleaseLabel("BTAC '22")).toEqual({ release_label: "BTAC '22", release_year: 2022 });
    expect(parseReleaseLabel("'95")).toEqual({ release_label: "'95", release_year: 1995 });
  });

  it("leaves batch-only labels without a year", () => {
    expect(parseReleaseLabel("Batch 22F")).toEqual({
      release_label: "Batch 22F",
      release_year: null,
    });
  });
});

describe("releasePatternPrompt", () => {
  it("maps known patterns to UI copy", () => {
    expect(releasePatternPrompt("year")).toBe("Which year? (e.g., 2021)");
    expect(releasePatternPrompt("batch")).toBe("Batch number? (optional)");
    expect(releasePatternPrompt("pick")).toBe("Store pick or barrel name? (optional)");
    expect(releasePatternPrompt(null)).toBeNull();
  });
});
