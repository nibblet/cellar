import { describe, expect, it } from "vitest";
import {
  extractBatchNumber,
  extractReleaseYear,
  finalizeCollapseProposals,
  formatBrandExpression,
  namesMatchSurvivor,
  normalizeAgeTier,
  proposeNormalization,
} from "./expression-normalize";

describe("extractReleaseYear", () => {
  it("prefers year_made", () => {
    expect(extractReleaseYear("Foo (2010 Release)", 2017)).toBe("2017");
  });

  it("parses parenthetical release year", () => {
    expect(extractReleaseYear("Four Roses LE Small Batch (2020 Release)")).toBe("2020");
  });
});

describe("extractBatchNumber", () => {
  it("parses hash and No. formats", () => {
    expect(extractBatchNumber("Fusion Series #6")).toBe("#6");
    expect(extractBatchNumber("Fusion Series No. 7")).toBe("#7");
    expect(extractBatchNumber("Baker's Single Barrel (No. 000185706)")).toBe("#000185706");
  });
});

describe("formatBrandExpression", () => {
  it("prefixes brand when missing", () => {
    expect(formatBrandExpression("1792", "Full Proof")).toBe("1792 Full Proof");
  });

  it("avoids double prefix", () => {
    expect(formatBrandExpression("1792", "1792 Full Proof")).toBe("1792 Full Proof");
  });
});

describe("namesMatchSurvivor", () => {
  it("ignores comma and apostrophe differences", () => {
    expect(namesMatchSurvivor("Baker's Single Barrel, 7 Year", "Baker's Single Barrel 7 Year")).toBe(
      true,
    );
  });
});

describe("normalizeAgeTier", () => {
  it("reads age from specs.age_label", () => {
    expect(
      normalizeAgeTier({
        id: "1",
        name: "Baker's Single Barrel (No. 000185706)",
        brand: "Baker's",
        specs: { age_label: "7" },
      }),
    ).toBe("7");
  });

  it("reads age from product name", () => {
    expect(
      normalizeAgeTier({
        id: "2",
        name: "Baker's 13 year old Single Barrel",
        brand: "Baker's",
        specs: null,
      }),
    ).toBe("13");
  });
});

describe("proposeNormalization", () => {
  it("proposes Fusion variant collapse", () => {
    const p = proposeNormalization({
      id: "1",
      name: "Fusion Series #6",
      brand: "Bardstown Bourbon Company",
      specs: { expression_type: "Straight Bourbon" },
    });
    expect(p.canonical_name).toBe("Fusion Series");
    expect(p.release_label).toBe("#6");
    expect(p.collapse).toBe(true);
  });

  it("collapses Birthday Bourbon vintages into one expression", () => {
    const inputs: NormalizationInput[] = [
      {
        id: "bb1",
        name: "Birthday Bourbon (2014 release) 12 year old",
        brand: "Old Forester",
        specs: { year_made: 2014, age_label: "12 yr" },
      },
      {
        id: "bb2",
        name: "Birthday Bourbon 2016",
        brand: "Old Forester",
        specs: { year_made: 2016, age_label: "12" },
      },
      {
        id: "bb3",
        name: "Birthday Bourbon (bottled 2012)",
        brand: "Old Forester",
        specs: { year_made: 2012, age_label: "12" },
      },
    ];
    const rows = inputs.map((input) => ({
      ...input,
      proposal: proposeNormalization(input),
    }));
    const finalized = finalizeCollapseProposals(rows);
    expect(finalized.every((r) => r.proposal.canonical_name === "Birthday Bourbon")).toBe(true);
    expect(finalized.every((r) => r.proposal.expression_label === "Birthday Bourbon")).toBe(true);
    expect(finalized.every((r) => r.proposal.vintages_matter)).toBe(false);
    expect(finalized.map((r) => r.proposal.release_label).sort()).toEqual(["2012", "2014", "2016"]);
    expect(finalized.every((r) => r.proposal.collapse)).toBe(true);
    expect(finalized.every((r) => !r.proposal.never_collapse_line)).toBe(true);
  });

  it("formats Jim Beam Black by age tier", () => {
    expect(
      proposeNormalization({
        id: "jb7",
        name: "Black 7 year old",
        brand: "Jim Beam",
        specs: { age_label: "7 yr" },
      }),
    ).toMatchObject({
      canonical_name: "Jim Beam Black 7 Year",
      expression_label: "Black 7 Year",
      collapse: false,
    });
    expect(
      proposeNormalization({
        id: "jb8",
        name: "Black 8 year old",
        brand: "Jim Beam",
        specs: { age_label: "8" },
      }).canonical_name,
    ).toBe("Jim Beam Black 8 Year");
  });

  it("collapses Angel's Envy Cask Strength annual releases", () => {
    const p = proposeNormalization({
      id: "ae-cs-2014",
      name: "Angel's Envy Cask Strength (2014 Release)",
      brand: "Angel's Envy",
      specs: { expression_type: "Cask Strength", year_made: 2014 },
    });
    expect(p.canonical_name).toBe("Angel's Envy Cask Strength");
    expect(p.release_label).toBe("2014");
    expect(p.release_pattern).toBe("year");
    expect(p.vintages_matter).toBe(false);
    expect(p.collapse).toBe(true);
    expect(p.blocked_by_expression_type).toBe(false);
  });

  it("keeps Angel's Envy Cask Strength separate from Port Barrel-Finished series", () => {
    const plain = proposeNormalization({
      id: "ae-cs",
      name: "Angel's Envy Cask Strength (2016 Release)",
      brand: "Angel's Envy",
      specs: { expression_type: "Cask Strength", year_made: 2016 },
    });
    const portBarrel = proposeNormalization({
      id: "ae-cs-pb",
      name: "Angel's Envy Cask Strength Port Barrel-Finished (2020 Release)",
      brand: "Angel's Envy",
      specs: { expression_type: "Cask Strength", year_made: 2020 },
    });
    expect(plain.canonical_name).toBe("Angel's Envy Cask Strength");
    expect(portBarrel.canonical_name).toBe("Angel's Envy Cask Strength Port Barrel-Finished");
    expect(plain.canonical_name).not.toBe(portBarrel.canonical_name);
  });

  it("leaves Angel's Envy Madeira as an identity expression", () => {
    const p = proposeNormalization({
      id: "ae-madeira",
      name: "Angel's Envy Madeira Cask Finished",
      brand: "Angel's Envy",
      specs: { expression_type: "Madeira Finished, Cask Finished", year_made: 2023 },
    });
    expect(p.canonical_name).toBe("Angel's Envy Madeira");
    expect(p.collapse).toBe(false);
  });

  it("collapses Baker's 7 Year single barrel variants", () => {
    const survivor = proposeNormalization({
      id: "bakers-7",
      name: "Baker's Single Barrel, 7 Year",
      brand: "Baker's",
      specs: { expression_type: "Single Barrel", age_label: "7 yr" },
    });
    const barrel = proposeNormalization({
      id: "bakers-barrel",
      name: "Baker's Single Barrel (No. 000185706)",
      brand: "Baker's",
      specs: { expression_type: "Single Barrel", age_label: "7", year_made: 2019 },
    });
    expect(survivor.canonical_name).toBe("Baker's Single Barrel 7 Year");
    expect(barrel.canonical_name).toBe("Baker's Single Barrel 7 Year");
    expect(survivor.is_survivor).toBe(true);
    expect(barrel.release_label).toBe("#000185706");
    expect(barrel.collapse).toBe(true);
  });

  it("splits Baker's 7 Year and 13 Year into separate expressions", () => {
    const seven = proposeNormalization({
      id: "bakers-7",
      name: "Baker's Single Barrel, 7 Year",
      brand: "Baker's",
      specs: { age_label: "7 yr" },
    });
    const thirteen = proposeNormalization({
      id: "bakers-13",
      name: "Baker's 13 year old Single Barrel",
      brand: "Baker's",
      specs: { age_label: "13 yr" },
    });
    expect(seven.canonical_name).toBe("Baker's Single Barrel 7 Year");
    expect(thirteen.canonical_name).toBe("Baker's Single Barrel 13 Year");
    expect(seven.canonical_name).not.toBe(thirteen.canonical_name);
  });

  it("maps 1792 identity and series expressions", () => {
    expect(
      proposeNormalization({
        id: "1792-ann",
        name: "1792 225th Anniversary",
        brand: "1792",
        specs: { expression_type: "Anniversary", year_made: 2017 },
      }).canonical_name,
    ).toBe("1792 Anniversary");

    expect(
      proposeNormalization({
        id: "1792-fp",
        name: "1792 Full Proof",
        brand: "1792",
        specs: { expression_type: "Full Proof" },
      }).canonical_name,
    ).toBe("1792 Full Proof");

    expect(
      proposeNormalization({
        id: "1792-12sb",
        name: "1792 12 year old Small Batch Kentucky Straight Bourbon",
        brand: "1792",
        specs: { expression_type: "Small Batch, Straight Bourbon", age_label: "12" },
      }).canonical_name,
    ).toBe("1792 12 year old Small Batch Kentucky Straight Bourbon");
  });
});

describe("Barrell", () => {
  it("maps staples with spirit type", () => {
    expect(
      proposeNormalization({
        id: "1",
        name: "Barrell Seagrass Rye",
        brand: "Barrell",
        specs: null,
      }),
    ).toMatchObject({
      canonical_name: "Barrell Seagrass",
      spirit_type: "rye",
      collapse: false,
    });

    expect(
      proposeNormalization({
        id: "2",
        name: "Barrell Vantage",
        brand: "Barrell",
        specs: null,
      }),
    ).toMatchObject({
      canonical_name: "Barrell Vantage",
      spirit_type: "bourbon",
    });
  });

  it("collapses core bourbon batches into Barrell Bourbon", () => {
    const p = proposeNormalization({
      id: "3",
      name: "Barrell Bourbon (Batch 004)",
      brand: "Barrell",
      specs: { year_made: 2015 },
    });
    expect(p).toMatchObject({
      canonical_name: "Barrell Bourbon",
      canonical_brand: "Barrell",
      release_label: "Batch 004",
      release_pattern: "batch",
      vintages_matter: false,
      collapse: true,
    });
  });

  it("collapses cask strength batches including aged no-batch rows", () => {
    const batch = proposeNormalization({
      id: "4",
      name: "Barrell Cask-Strength Bourbon (Batch 015)",
      brand: "Barrell",
      specs: { expression_type: "Cask Strength", year_made: 2018 },
    });
    const aged = proposeNormalization({
      id: "5",
      name: "Barrell 15 year old Cask-Strength Bourbon",
      brand: "Barrell",
      specs: { expression_type: "Cask Strength" },
    });
    expect(batch.canonical_name).toBe("Barrell Bourbon Cask Strength");
    expect(aged.canonical_name).toBe("Barrell Bourbon Cask Strength");
    expect(batch.collapse).toBe(true);
    expect(aged.collapse).toBe(true);
    expect(batch.vintages_matter).toBe(false);
  });

  it("collapses all New Year editions into one vintage-tracked expression", () => {
    const standard = proposeNormalization({
      id: "6",
      name: "Barrell New Year Blend of Straight Bourbons (2021 Edition)",
      brand: "Barrell",
      specs: { year_made: 2021 },
    });
    const cs = proposeNormalization({
      id: "7",
      name: "Barrell Bourbon Cask Strength New Year Edition 2023",
      brand: "Barrell",
      specs: { year_made: 2023 },
    });
    expect(standard.canonical_name).toBe("Barrell New Year");
    expect(cs.canonical_name).toBe("Barrell New Year");
    expect(standard.vintages_matter).toBe(false);
    expect(cs.release_label).toBe("2023");
  });

  it("merges Barrell Craft Spirits brand to Barrell", () => {
    const p = proposeNormalization({
      id: "8",
      name: "(2022 Release)",
      brand: "Barrell Craft Spirits",
      specs: { expression_type: "Gray Label", year_made: 2022 },
    });
    expect(p).toMatchObject({
      canonical_name: "Barrell Gray Label",
      canonical_brand: "Barrell",
      release_label: "2022",
    });
  });

  it("keeps cask finish series as three identity rows", () => {
    const amburana = proposeNormalization({
      id: "9",
      name: "Barrell Bourbon Cask Finish Series: 5 year old Amburana",
      brand: "Barrell",
      specs: { expression_type: "Cask Finished" },
    });
    expect(amburana.canonical_name).toBe("Barrell Cask Finish Series");
    expect(amburana.expression_label).toBe("Amburana");
    expect(amburana.collapse).toBe(false);
  });
});

describe("finalizeCollapseProposals", () => {
  it("keeps Angel's Envy Cask Strength group collapsible", () => {
    const rows = [2012, 2014, 2016].map((year) => {
      const input = {
        id: `ae-${year}`,
        name: `Angel's Envy Cask Strength (${year} Release)`,
        brand: "Angel's Envy",
        specs: { expression_type: "Cask Strength", year_made: year },
      };
      return { ...input, proposal: proposeNormalization(input) };
    });
    const finalized = finalizeCollapseProposals(rows);
    expect(finalized.every((r) => r.proposal.collapse)).toBe(true);
  });

  it("does not merge Baker's rows across age tiers", () => {
    const inputs = [
      {
        id: "b7",
        name: "Baker's Single Barrel, 7 Year",
        brand: "Baker's",
        specs: { age_label: "7 yr" },
      },
      {
        id: "b13",
        name: "Baker's 13 year old Single Barrel",
        brand: "Baker's",
        specs: { age_label: "13 yr" },
      },
    ];
    const rows = inputs.map((input) => ({ ...input, proposal: proposeNormalization(input) }));
    const finalized = finalizeCollapseProposals(rows);
    expect(finalized[0].proposal.canonical_name).not.toBe(finalized[1].proposal.canonical_name);
  });
});
