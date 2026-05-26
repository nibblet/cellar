import { describe, expect, it } from "vitest";
import { buildCollapseAnalysis, type CatalogProductRow } from "./collapse-groups";

function row(
  id: string,
  name: string,
  opts: Partial<CatalogProductRow> & { collapse?: boolean; year?: number } = {},
): CatalogProductRow {
  return {
    id,
    name,
    brand: opts.brand ?? "Test",
    release_pattern: opts.release_pattern ?? null,
    specs: {
      curation_collapse: opts.collapse ? "Y" : "N",
      ...(opts.year != null ? { year_made: opts.year } : {}),
      ...(opts.specs ?? {}),
    },
  };
}

describe("buildCollapseAnalysis", () => {
  it("groups year variants into one survivor", () => {
    const analysis = buildCollapseAnalysis([
      row("a", "Angel's Envy Cask Strength", { collapse: true, year: 2016 }),
      row("b", "Angel's Envy Cask Strength", { collapse: true, year: 2018 }),
    ]);

    expect(analysis.groups).toHaveLength(1);
    expect(analysis.groups[0]?.variants).toHaveLength(1);
    expect(analysis.groups[0]?.previewLabels).toEqual(["2018"]);
    expect(analysis.entries).toHaveLength(1);
    expect(analysis.entries[0]?.release_label).toBe("2018");
  });

  it("flags solo collapse rows", () => {
    const analysis = buildCollapseAnalysis([
      row("solo", "Lonely Single Barrel", { collapse: true }),
    ]);

    expect(analysis.groups).toHaveLength(0);
    expect(analysis.soloFlags).toHaveLength(1);
  });
});
