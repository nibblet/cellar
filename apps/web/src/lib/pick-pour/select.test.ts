import { describe, expect, it } from "vitest";
import { pickPourSeedKey, selectPickPour } from "./select";

describe("pickPourSeedKey", () => {
  it("includes roll index in the seed", () => {
    expect(pickPourSeedKey({ memberId: "m1", date: "2026-05-23", rollIndex: 0 })).toBe(
      "m1|2026-05-23|0",
    );
    expect(pickPourSeedKey({ memberId: "m1", date: "2026-05-23", rollIndex: 3 })).toBe(
      "m1|2026-05-23|3",
    );
  });
});

describe("selectPickPour", () => {
  const pool = ["a", "b", "c", "d", "e"];

  it("returns null for an empty pool", () => {
    expect(selectPickPour({ memberId: "m1", date: "2026-05-23", rollIndex: 0 }, [])).toBeNull();
  });

  it("returns the same candidate for the same seed", () => {
    const seed = { memberId: "m1", date: "2026-05-23", rollIndex: 0 };
    expect(selectPickPour(seed, pool)).toBe(selectPickPour(seed, pool));
  });

  it("usually returns a different candidate when roll index increments", () => {
    const picks = new Set(
      [0, 1, 2, 3, 4].map((rollIndex) =>
        selectPickPour({ memberId: "m1", date: "2026-05-23", rollIndex }, pool),
      ),
    );
    expect(picks.size).toBeGreaterThan(1);
  });

  it("always returns an item from the pool", () => {
    for (let i = 0; i < 20; i++) {
      const pick = selectPickPour({ memberId: `m${i}`, date: "2026-05-23", rollIndex: 0 }, pool);
      expect(pool).toContain(pick);
    }
  });
});
