import { describe, expect, it } from "vitest";
import { pairingTier, pairingTierLabel } from "./tier";

describe("pairingTier", () => {
  it("maps score bands at 75, 65, and 55", () => {
    expect(pairingTier(75)).toBe("fine");
    expect(pairingTier(74)).toBe("good");
    expect(pairingTier(65)).toBe("good");
    expect(pairingTier(64)).toBe("worth");
    expect(pairingTier(55)).toBe("worth");
    expect(pairingTier(54)).toBe("curious");
  });

  it("returns human labels", () => {
    expect(pairingTierLabel(80)).toBe("Definite pair");
    expect(pairingTierLabel(70)).toBe("Good match");
    expect(pairingTierLabel(60)).toBe("Worth a try");
    expect(pairingTierLabel(50)).toBe("Curious pairing");
  });
});
