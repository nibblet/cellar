import { describe, expect, it } from "vitest";
import { productMatchesPreferences } from "./match";
import { EMPTY_PREFERENCES, type MemberPreferences } from "./types";

function prefs(partial: Partial<MemberPreferences>): MemberPreferences {
  return { ...EMPTY_PREFERENCES, ...partial };
}

describe("productMatchesPreferences", () => {
  it("never matches when preferences are empty (badge stays dark)", () => {
    expect(
      productMatchesPreferences(
        { type: "cigar", specs: { strength: "medium", wrapper: "Habano" } },
        EMPTY_PREFERENCES,
      ),
    ).toBe(false);
  });

  it("matches cigar on strength alone", () => {
    expect(
      productMatchesPreferences(
        { type: "cigar", specs: { strength: "medium-full", wrapper: "Cameroon" } },
        prefs({ cigar_strengths: ["medium-full"] }),
      ),
    ).toBe(true);
  });

  it("matches cigar on wrapper bucket alone", () => {
    expect(
      productMatchesPreferences(
        { type: "cigar", specs: { strength: "mild", wrapper: "San Andres Maduro" } },
        prefs({ cigar_wrappers: ["san-andres"] }),
      ),
    ).toBe(true);
  });

  it("does not match cigar when no axis overlaps", () => {
    expect(
      productMatchesPreferences(
        { type: "cigar", specs: { strength: "mild", wrapper: "Connecticut Shade" } },
        prefs({ cigar_strengths: ["full"], cigar_wrappers: ["habano"] }),
      ),
    ).toBe(false);
  });

  it("matches bourbon on derived style", () => {
    expect(
      productMatchesPreferences(
        {
          type: "bourbon",
          specs: { whiskey_type: "Bourbon", mash_bill: "Corn, Wheat, Malted Barley" },
        },
        prefs({ bourbon_styles: ["wheated"] }),
      ),
    ).toBe(true);
  });

  it("matches bourbon on proof band alone", () => {
    expect(
      productMatchesPreferences(
        { type: "bourbon", specs: { proof: 120 } },
        prefs({ bourbon_proof_bands: ["high"] }),
      ),
    ).toBe(true);
  });

  it("handles proof stored as a string spec", () => {
    expect(
      productMatchesPreferences(
        { type: "bourbon", specs: { proof: "92.5" } },
        prefs({ bourbon_proof_bands: ["mid"] }),
      ),
    ).toBe(true);
  });

  it("does not match bourbon when style and proof both miss", () => {
    expect(
      productMatchesPreferences(
        {
          type: "bourbon",
          specs: { whiskey_type: "Bourbon", mash_bill: "Corn, Rye, Malted Barley", proof: 86 },
        },
        prefs({ bourbon_styles: ["wheated"], bourbon_proof_bands: ["high"] }),
      ),
    ).toBe(false);
  });

  it("OR semantics across both bourbon axes", () => {
    expect(
      productMatchesPreferences(
        { type: "bourbon", specs: { proof: 95 } },
        prefs({ bourbon_styles: ["rye"], bourbon_proof_bands: ["mid"] }),
      ),
    ).toBe(true);
  });
});
