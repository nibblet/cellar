import { describe, expect, it } from "vitest";
import { fnv1a32, seedKey, selectDailyPour, todayKey } from "./select";

describe("fnv1a32", () => {
  it("is deterministic for the same input", () => {
    expect(fnv1a32("foo")).toBe(fnv1a32("foo"));
  });

  it("produces different hashes for different inputs", () => {
    expect(fnv1a32("foo")).not.toBe(fnv1a32("bar"));
  });

  it("returns an unsigned 32-bit integer", () => {
    const h = fnv1a32("anything");
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
    expect(Number.isInteger(h)).toBe(true);
  });
});

describe("seedKey", () => {
  it("combines member id and date with a separator", () => {
    expect(seedKey({ memberId: "abc", date: "2026-05-21" })).toBe("abc|2026-05-21");
  });
});

describe("selectDailyPour", () => {
  const pool = ["a", "b", "c", "d", "e"];

  it("returns null for an empty pool", () => {
    expect(selectDailyPour({ memberId: "m1", date: "2026-05-21" }, [])).toBeNull();
  });

  it("returns the same candidate for the same seed", () => {
    const seed = { memberId: "m1", date: "2026-05-21" };
    const a = selectDailyPour(seed, pool);
    const b = selectDailyPour(seed, pool);
    expect(a).toBe(b);
  });

  it("returns a different candidate when the date rolls (usually)", () => {
    // Same member, different dates — at least one pair across a week should
    // differ. Hash collisions exist but spanning 7 days makes the test stable.
    const picks = new Set(
      ["2026-05-21", "2026-05-22", "2026-05-23", "2026-05-24", "2026-05-25"].map((d) =>
        selectDailyPour({ memberId: "m1", date: d }, pool),
      ),
    );
    expect(picks.size).toBeGreaterThan(1);
  });

  it("spreads across the pool over many seeds", () => {
    // Sanity: hashing 100 random member IDs should land on at least 3 of the
    // 5 candidates. (Strict uniformity would require a larger sample.)
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const pick = selectDailyPour({ memberId: `m${i}`, date: "2026-05-21" }, pool);
      if (pick) seen.add(pick);
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  it("always returns an item from the pool", () => {
    for (let i = 0; i < 20; i++) {
      const pick = selectDailyPour({ memberId: `m${i}`, date: "2026-05-21" }, pool);
      expect(pool).toContain(pick);
    }
  });
});

describe("todayKey", () => {
  it("formats a date as YYYY-MM-DD in UTC", () => {
    const d = new Date("2026-05-21T18:30:00Z");
    expect(todayKey(d)).toBe("2026-05-21");
  });

  it("uses UTC, not local time", () => {
    // 23:30 UTC on the 21st is still the 21st regardless of local TZ.
    const d = new Date("2026-05-21T23:30:00Z");
    expect(todayKey(d)).toBe("2026-05-21");
  });
});
