import { describe, expect, it } from "vitest";
import { pickBestMatch } from "./normalize";

describe("pairing catalog match (pickBestMatch)", () => {
  const candidates = [
    { id: "c1", name: "Cafe Espresso 460", brand: "Nub" },
    { id: "c2", name: "Cafe Cappuccino 460", brand: "Nub" },
    { id: "b1", name: "The Holiday Toast", brand: "Lucky Seven" },
    { id: "b2", name: "The Frenchman", brand: "Lucky Seven" },
  ];

  it("matches Nub espresso cigar from band-style vision name", () => {
    const best = pickBestMatch(candidates.slice(0, 2), {
      name: "Cafe Espresso",
      brand: "Nub",
    });
    expect(best?.product.id).toBe("c1");
    expect(best?.score).toBeGreaterThanOrEqual(0.55);
  });

  it("matches Lucky Seven Holiday Toast bourbon", () => {
    const best = pickBestMatch(candidates.slice(2), {
      name: "The Holiday Toast Kentucky Straight Bourbon",
      brand: "Lucky Seven",
    });
    expect(best?.product.id).toBe("b1");
    expect(best?.score).toBeGreaterThanOrEqual(0.55);
  });

  it("returns null scorer when candidate list empty", () => {
    const best = pickBestMatch([], { name: "Unknown", brand: null });
    expect(best).toBeNull();
  });
});
