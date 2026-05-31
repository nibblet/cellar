import { describe, expect, it } from "vitest";
import type { CatalogGroup } from "@/lib/feed/catalog-queries";
import {
  buildMakerSummaries,
  filterProductsForBrandBrowse,
  makerSlugForCatalogGroup,
} from "./browse";

describe("buildMakerSummaries", () => {
  it("counts products per brand and type", () => {
    const summaries = buildMakerSummaries(
      [
        { brand: "Oliva", type: "cigar" },
        { brand: "Oliva", type: "cigar" },
        { brand: "Buffalo Trace", type: "bourbon" },
      ],
      [],
    );
    expect(summaries).toHaveLength(2);
    const oliva = summaries.find((s) => s.name === "Oliva");
    expect(oliva?.product_count).toBe(2);
    expect(oliva?.type).toBe("cigar");
    expect(oliva?.slug).toBe("oliva");
  });

  it("filters by product type", () => {
    const summaries = buildMakerSummaries(
      [
        { brand: "Oliva", type: "cigar" },
        { brand: "Buffalo Trace", type: "bourbon" },
      ],
      [],
      "bourbon",
    );
    expect(summaries).toHaveLength(1);
    expect(summaries[0].name).toBe("Buffalo Trace");
  });

  it("merges makers table metadata", () => {
    const summaries = buildMakerSummaries(
      [{ brand: "Oliva Cigar", type: "cigar" }],
      [
        {
          slug: "oliva-cigar",
          name: "Oliva Cigar",
          type: "cigar",
          country: "Nicaragua",
          house_style: "Cedar · earth",
        },
      ],
    );
    expect(summaries[0].country).toBe("Nicaragua");
    expect(summaries[0].house_style).toBe("Cedar · earth");
  });

  it("sorts by name", () => {
    const summaries = buildMakerSummaries(
      [
        { brand: "Zebra", type: "cigar" },
        { brand: "Alpha", type: "cigar" },
      ],
      [],
    );
    expect(summaries.map((s) => s.name)).toEqual(["Alpha", "Zebra"]);
  });
});

describe("filterProductsForBrandBrowse", () => {
  it("excludes products above the member max catalog tier", () => {
    const rows = filterProductsForBrandBrowse(
      [
        { brand: "Eagle Rare", type: "bourbon", specs: { tier: 2 } },
        { brand: "Eagle Rare", type: "bourbon", specs: { tier: 5 } },
        { brand: "Buffalo Trace", type: "bourbon", specs: { tier: 1 } },
      ],
      2,
    );
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.brand === "Eagle Rare")).toHaveLength(1);
  });
});

describe("makerSlugForCatalogGroup", () => {
  const group = (over: Partial<CatalogGroup>): CatalogGroup => ({
    brand_family: "Knob Creek",
    entries: [],
    ...over,
  });

  it("uses core-range product brand for the slug", () => {
    const slug = makerSlugForCatalogGroup(
      group({
        entries: [
          {
            product_id: "limited",
            name: "Knob Creek 15",
            brand: "Jim Beam",
            brand_family: "Knob Creek",
            expression: null,
            is_core_range: false,
            type: "bourbon",
            hero_image_path: null,
            catalog_image_url: null,
            matches_preferences: false,
            subtitle: null,
          },
          {
            product_id: "core",
            name: "Knob Creek 12",
            brand: "Knob Creek",
            brand_family: "Knob Creek",
            expression: null,
            is_core_range: true,
            type: "bourbon",
            hero_image_path: null,
            catalog_image_url: null,
            matches_preferences: false,
            subtitle: null,
          },
        ],
      }),
    );
    expect(slug).toBe("knob-creek");
  });

  it("falls back to brand_family when no product brand", () => {
    expect(
      makerSlugForCatalogGroup(
        group({
          brand_family: "Eagle Rare",
          entries: [
            {
              product_id: "x",
              name: "X",
              brand: null,
              brand_family: "Eagle Rare",
              expression: null,
              is_core_range: false,
              type: "bourbon",
              hero_image_path: null,
              catalog_image_url: null,
              matches_preferences: false,
              subtitle: null,
            },
          ],
        }),
      ),
    ).toBe("eagle-rare");
  });

  it("returns null when no brand signal", () => {
    expect(makerSlugForCatalogGroup(group({ brand_family: null, entries: [] }))).toBeNull();
  });
});
