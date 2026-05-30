import { describe, expect, it } from "vitest";
import { PAIRING_TRAITS, type PairingTrait, type TraitVector } from "@/lib/wheel";
import { deriveHouseStyleLine } from "./house-style";

function vec(overrides: Partial<Record<PairingTrait, number>>): TraitVector {
  const v = {} as TraitVector;
  for (const trait of PAIRING_TRAITS) v[trait] = overrides[trait] ?? 0;
  return v;
}

describe("deriveHouseStyleLine", () => {
  it("returns empty string when no dominant traits", () => {
    expect(deriveHouseStyleLine(vec({}), "Oliva")).toBe("");
  });

  it("formats a one-line house read from dominant traits", () => {
    const line = deriveHouseStyleLine(vec({ sweet: 0.9, woody: 0.6, earthy: 0.4 }), "Oliva");
    expect(line).toBe("Oliva leans sweet, woody, earthy.");
  });
});
