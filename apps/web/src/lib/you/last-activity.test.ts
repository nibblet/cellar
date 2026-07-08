import { describe, expect, it } from "vitest";
import { buildLastActivityLine } from "./last-activity";

describe("buildLastActivityLine", () => {
  it("uses poured for bourbons", () => {
    expect(buildLastActivityLine({ type: "bourbon", name: "Eagle Rare 10" })).toBe(
      '"You poured Eagle Rare 10 last."',
    );
  });

  it("uses lit for cigars", () => {
    expect(buildLastActivityLine({ type: "cigar", name: "Padron 1964" })).toBe(
      '"You lit Padron 1964 last."',
    );
  });

  it("returns null when no product exists", () => {
    expect(buildLastActivityLine(null)).toBeNull();
  });
});
