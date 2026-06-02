import { describe, expect, it } from "vitest";
import { composeProductSubtitle } from "./product-subtitle";

describe("composeProductSubtitle", () => {
  it("includes availability when non-everyday", () => {
    const s = composeProductSubtitle("bourbon", { availability_rarity: "allocated" });
    expect(s).toContain("Allocated");
  });

  it("omits availability when everyday", () => {
    const s = composeProductSubtitle("bourbon", { availability_rarity: "everyday" });
    expect(s).toBeNull();
  });

  it("includes tier when present", () => {
    const s = composeProductSubtitle("bourbon", { tier: 3 });
    expect(s).toContain("Tier 3");
  });

  it("includes allocated and tier together", () => {
    const s = composeProductSubtitle("bourbon", {
      availability_rarity: "allocated",
      tier: 4,
      proof: 95,
    });
    expect(s).toContain("Allocated");
    expect(s).toContain("Tier 4");
    expect(s).toContain("95 proof");
  });

  it("does not include availability for cigars", () => {
    const s = composeProductSubtitle("cigar", { availability_rarity: "allocated" });
    expect(s ?? "").not.toContain("Allocated");
  });
});
