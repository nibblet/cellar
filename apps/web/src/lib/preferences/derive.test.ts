import { describe, expect, it } from "vitest";
import {
  bucketCigarWrapper,
  deriveBourbonStyles,
  deriveProofBand,
  normalizeCigarStrength,
} from "./derive";

describe("normalizeCigarStrength", () => {
  it("maps canonical strengths through", () => {
    expect(normalizeCigarStrength("mild")).toBe("mild");
    expect(normalizeCigarStrength("medium")).toBe("medium");
    expect(normalizeCigarStrength("full")).toBe("full");
  });

  it("collapses two-word variants", () => {
    expect(normalizeCigarStrength("mild to medium")).toBe("mild-medium");
    expect(normalizeCigarStrength("medium/full")).toBe("medium-full");
  });

  it("returns null on unknown / missing", () => {
    expect(normalizeCigarStrength(null)).toBeNull();
    expect(normalizeCigarStrength("")).toBeNull();
    expect(normalizeCigarStrength("powerful")).toBeNull();
  });
});

describe("bucketCigarWrapper", () => {
  it("collapses common Habano variants", () => {
    expect(bucketCigarWrapper("Habano")).toBe("habano");
    expect(bucketCigarWrapper("Ecuadorian Habano")).toBe("habano");
    expect(bucketCigarWrapper("Honduran Habano")).toBe("habano");
    expect(bucketCigarWrapper("Nicaraguan Habano")).toBe("habano");
  });

  it("collapses Connecticut variants", () => {
    expect(bucketCigarWrapper("Connecticut Shade")).toBe("connecticut");
    expect(bucketCigarWrapper("Ecuadorian Connecticut")).toBe("connecticut");
  });

  it("groups Maduro and Broadleaf together", () => {
    expect(bucketCigarWrapper("Maduro")).toBe("maduro");
    expect(bucketCigarWrapper("Connecticut Broadleaf")).toBe("maduro");
    expect(bucketCigarWrapper("Connecticut Broadleaf Maduro")).toBe("maduro");
    expect(bucketCigarWrapper("Habano Maduro")).toBe("maduro");
  });

  it("keeps San Andrés distinct from generic Maduro", () => {
    expect(bucketCigarWrapper("San Andres Maduro")).toBe("san-andres");
    expect(bucketCigarWrapper("Mexican San Andres")).toBe("san-andres");
    expect(bucketCigarWrapper("Mexican San Andrés Maduro")).toBe("san-andres");
  });

  it("keeps Oscuro distinct from Habano", () => {
    expect(bucketCigarWrapper("Habano Oscuro")).toBe("oscuro");
    expect(bucketCigarWrapper("Ecuadorian Habano Oscuro")).toBe("oscuro");
  });

  it("returns null on null / unknown", () => {
    expect(bucketCigarWrapper(null)).toBeNull();
    expect(bucketCigarWrapper("Goldilocks")).toBeNull();
  });
});

describe("deriveBourbonStyles", () => {
  it("identifies wheated from BWH style_family + mash bill", () => {
    const styles = deriveBourbonStyles({
      style_family: "BWH",
      mash_bill: "Corn, Wheat, Malted Barley",
      whiskey_type: "Bourbon",
    });
    expect(styles).toContain("wheated");
    expect(styles).toContain("bourbon");
    expect(styles).not.toContain("rye");
  });

  it("identifies rye from whiskey_type, not bourbon", () => {
    const styles = deriveBourbonStyles({
      whiskey_type: "Kentucky Straight Rye Whiskey",
      mash_bill: "Rye, Corn, Malted Barley",
    });
    expect(styles).toContain("rye");
    expect(styles).not.toContain("wheated");
  });

  it("flags high-rye when mash bill names ≥20% rye", () => {
    const styles = deriveBourbonStyles({
      whiskey_type: "Bourbon",
      mash_bill: "75% corn, 21% rye, 4% malted barley",
    });
    expect(styles).toContain("high-rye");
    expect(styles).toContain("bourbon");
  });

  it("does NOT flag high-rye on a bourbon with token rye but low percentage", () => {
    const styles = deriveBourbonStyles({
      whiskey_type: "Bourbon",
      mash_bill: "78% corn, 10% rye, 12% malt",
    });
    expect(styles).not.toContain("high-rye");
  });

  it("detects bottled-in-bond from name and notes", () => {
    expect(deriveBourbonStyles({ name: "Henry McKenna Bottled-in-Bond" })).toContain(
      "bottled-in-bond",
    );
    expect(deriveBourbonStyles({ additional_notes: "BiB release, 100 proof" })).toContain(
      "bottled-in-bond",
    );
  });

  it("detects single barrel", () => {
    expect(deriveBourbonStyles({ name: "Eagle Rare Single Barrel, 10 Year" })).toContain(
      "single-barrel",
    );
  });

  it("returns [] for null specs", () => {
    expect(deriveBourbonStyles(null)).toEqual([]);
  });
});

describe("deriveProofBand", () => {
  it("buckets correctly", () => {
    expect(deriveProofBand(80)).toBe("low");
    expect(deriveProofBand(90)).toBe("low");
    expect(deriveProofBand(91)).toBe("mid");
    expect(deriveProofBand(100)).toBe("mid");
    expect(deriveProofBand(110)).toBe("high");
    expect(deriveProofBand(145)).toBe("high");
  });

  it("returns null for null / NaN", () => {
    expect(deriveProofBand(null)).toBeNull();
    expect(deriveProofBand(Number.NaN)).toBeNull();
  });
});
