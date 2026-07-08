import { describe, expect, it } from "vitest";
import { deprioritizeRecent, rotateDaily } from "./daily-rotation";

describe("rotateDaily", () => {
  const items = ["a", "b", "c", "d", "e", "f", "g", "h"];

  it("is stable for same seed", () => {
    expect(rotateDaily(items, "member|2026-07-07|bourbon", 4)).toEqual(
      rotateDaily(items, "member|2026-07-07|bourbon", 4),
    );
  });

  it("returns at most limit items", () => {
    expect(rotateDaily(items, "x", 3)).toHaveLength(3);
  });
});

describe("deprioritizeRecent", () => {
  it("moves recent ids to the tail", () => {
    const items = [{ product_id: "a" }, { product_id: "b" }, { product_id: "c" }];
    expect(deprioritizeRecent(items, new Set(["b"])).map((i) => i.product_id)).toEqual([
      "a",
      "c",
      "b",
    ]);
  });
});
