import { describe, expect, it } from "vitest";
import {
  buildNormalizationContext,
  formatLineBrandCanonical,
  resolveLineBrand,
} from "./line-brand";
import { finalizeCollapseProposals, proposeNormalization, type NormalizationInput } from "./expression-normalize";

function btInput(
  id: string,
  name: string,
  specs: Record<string, unknown> | null = null,
): NormalizationInput {
  return { id, name, brand: "Buffalo Trace", specs };
}

describe("resolveLineBrand", () => {
  const context = buildNormalizationContext([
    btInput("1", "Experimental Collection Standard Stave Drying Time"),
    btInput("2", "Experimental Collection Extended Stave Drying Time"),
    btInput("3", "Experimental Collection Hot Box Toasted Barrel"),
    btInput("4", "William Larue Weller"),
    btInput("5", "William Larue Weller"),
    btInput("6", "William Larue Weller"),
  ]);

  it("parses Experimental Collection title format", () => {
    const r = resolveLineBrand(
      btInput("1", "Experimental Collection Standard Stave Drying Time", { year_made: 2022 }),
      context,
    );
    expect(r).toMatchObject({
      lineBrand: "Experimental Collection",
      expression: "Standard Stave Drying Time",
      kind: "identity",
    });
    expect(formatLineBrandCanonical(r!.lineBrand, r!.expression)).toBe(
      "Experimental Collection Standard Stave Drying Time",
    );
  });

  it("parses Experimental Collection comma format", () => {
    const r = resolveLineBrand(
      btInput("2", "Experimental Collection, 14 year old, Coarse Grain Oak", { year_made: 2022 }),
      context,
    );
    expect(r).toMatchObject({
      lineBrand: "Experimental Collection",
      expression: "Coarse Grain Oak",
      kind: "identity",
    });
  });

  it("does not treat W.L. Weller shelf SKUs as BTAC William Larue Weller", () => {
    const r = resolveLineBrand(
      { id: "sr", name: "Special Reserve", brand: "W.L. Weller", specs: null },
      { lineBrandPrefixCounts: new Map() },
    );
    expect(r).toBeNull();
  });

  it("collapses WLW BTAC rows as a series", () => {
    const inputs = [
      btInput("w1", "William Larue Weller", { year_made: 2021 }),
      btInput("w2", "William Larue Weller", { year_made: 2022 }),
      btInput("w3", "William Larue Weller (Buffalo Trace Antique Collection 2017)", {
        year_made: 2017,
      }),
    ];
    const ctx = buildNormalizationContext(inputs);
    const rows = inputs.map((input) => ({
      ...input,
      proposal: proposeNormalization(input, ctx),
    }));
    const finalized = finalizeCollapseProposals(rows);
    expect(finalized.every((r) => r.proposal.canonical_name === "William Larue Weller")).toBe(true);
    expect(finalized.filter((r) => r.proposal.collapse).length).toBe(3);
    expect(finalized[0].proposal.vintages_matter).toBe(false);
  });
});
