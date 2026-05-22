import { describe, expect, it } from "vitest";
import { applyCellarBias } from "./bias";
import { ZERO_ROW, applyPatch, isZeroRow } from "./types";
import type { CellarSnapshot } from "./types";

// ---------------------------------------------------------------------------
// applyPatch
// ---------------------------------------------------------------------------

describe("applyPatch", () => {
  it("merges a simple patch", () => {
    expect(applyPatch(ZERO_ROW, { tried: true })).toEqual({ have: false, want: false, tried: true });
  });

  it("have=true clears want", () => {
    const current = { have: false, want: true, tried: false };
    const next = applyPatch(current, { have: true });
    expect(next.have).toBe(true);
    expect(next.want).toBe(false);
  });

  it("want=true clears have", () => {
    const current = { have: true, want: false, tried: true };
    const next = applyPatch(current, { want: true });
    expect(next.want).toBe(true);
    expect(next.have).toBe(false);
    // tried is not forced to false when have is cleared
    expect(next.tried).toBe(true);
  });

  it("have=true implies tried=true even when tried was false", () => {
    const next = applyPatch(ZERO_ROW, { have: true });
    expect(next.tried).toBe(true);
  });

  it("have=true does not downgrade tried that was already true", () => {
    const current = { have: false, want: false, tried: true };
    const next = applyPatch(current, { have: true });
    expect(next.tried).toBe(true);
  });

  it("tried can be set to false independently of have/want", () => {
    const current = { have: false, want: false, tried: true };
    const next = applyPatch(current, { tried: false });
    expect(next.tried).toBe(false);
    expect(next.have).toBe(false);
  });

  it("have and want cannot both end up true — want patch wins via patch order", () => {
    const next = applyPatch({ have: true, want: false, tried: true }, { want: true });
    expect(next.have).toBe(false);
    expect(next.want).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isZeroRow
// ---------------------------------------------------------------------------

describe("isZeroRow", () => {
  it("returns true for the zero row", () => {
    expect(isZeroRow(ZERO_ROW)).toBe(true);
  });

  it("returns false when any flag is set", () => {
    expect(isZeroRow({ have: false, want: false, tried: true })).toBe(false);
    expect(isZeroRow({ have: true, want: false, tried: false })).toBe(false);
    expect(isZeroRow({ have: false, want: true, tried: false })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applyCellarBias
// ---------------------------------------------------------------------------

const snapshot = (opts: {
  cigarTried?: boolean;
  cigarHave?: boolean;
  bourbonTried?: boolean;
  bourbonHave?: boolean;
}): CellarSnapshot => ({
  have: new Set([
    ...(opts.cigarHave ? ["cigar-1"] : []),
    ...(opts.bourbonHave ? ["bourbon-1"] : []),
  ]),
  want: new Set(),
  tried: new Set([
    ...(opts.cigarTried ? ["cigar-1"] : []),
    ...(opts.bourbonTried ? ["bourbon-1"] : []),
  ]),
});

describe("applyCellarBias", () => {
  it("returns base score when nothing is in cellar", () => {
    const s = snapshot({});
    expect(applyCellarBias(70, s, "cigar-1", "bourbon-1")).toBe(70);
  });

  it("adds 3 for cigar tried", () => {
    expect(applyCellarBias(70, snapshot({ cigarTried: true }), "cigar-1", "bourbon-1")).toBe(73);
  });

  it("adds 3 for bourbon tried", () => {
    expect(applyCellarBias(70, snapshot({ bourbonTried: true }), "cigar-1", "bourbon-1")).toBe(73);
  });

  it("adds 2 on top of tried for cigar have", () => {
    // have implies tried in app logic, so both flags fire
    expect(
      applyCellarBias(70, snapshot({ cigarTried: true, cigarHave: true }), "cigar-1", "bourbon-1"),
    ).toBe(75); // +3 tried +2 have
  });

  it("max boost is +10 and never exceeds 100", () => {
    const full = snapshot({ cigarTried: true, cigarHave: true, bourbonTried: true, bourbonHave: true });
    expect(applyCellarBias(95, full, "cigar-1", "bourbon-1")).toBe(100);
    expect(applyCellarBias(70, full, "cigar-1", "bourbon-1")).toBe(80);
  });

  it("does not apply bias for unrecognized product ids", () => {
    const full = snapshot({ cigarTried: true, cigarHave: true, bourbonTried: true, bourbonHave: true });
    expect(applyCellarBias(70, full, "other-cigar", "other-bourbon")).toBe(70);
  });
});
