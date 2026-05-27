import { describe, expect, it } from "vitest";
import { classifyReleaseKind } from "./release-kind";

describe("classifyReleaseKind", () => {
  it("detects private selections / club picks", () => {
    expect(classifyReleaseKind("Private Selection")).toBe("private-selection");
    expect(classifyReleaseKind("NCCC Club Pick")).toBe("private-selection");
    expect(classifyReleaseKind("Private Barrel #12")).toBe("private-selection");
  });

  it("detects store picks", () => {
    expect(classifyReleaseKind("Total Wine Store Pick")).toBe("store-pick");
    expect(classifyReleaseKind("Barrel Pick")).toBe("store-pick");
    expect(classifyReleaseKind("Hand-Selected")).toBe("store-pick");
  });

  it("detects named batches", () => {
    expect(classifyReleaseKind("Batch C923")).toBe("batch");
    expect(classifyReleaseKind("Batch 19-01")).toBe("batch");
    expect(classifyReleaseKind("B522")).toBe("batch");
  });

  it("detects vintages", () => {
    expect(classifyReleaseKind("2013")).toBe("vintage");
    expect(classifyReleaseKind("1998")).toBe("vintage");
  });

  it("returns null for unclassifiable or empty labels", () => {
    expect(classifyReleaseKind("Total Wine")).toBeNull();
    expect(classifyReleaseKind("")).toBeNull();
    expect(classifyReleaseKind(null)).toBeNull();
  });

  it("prefers private selection over store pick when both signals appear", () => {
    expect(classifyReleaseKind("Private Selection Barrel Pick")).toBe("private-selection");
  });
});
