import { describe, expect, it } from "vitest";
import type { FindNextProductSuggestion, FindNextSuggestions } from "@/lib/find-next/types";
import {
  buildHomeV2Sections,
  deriveHomeV2Visibility,
  type HomeProductDetail,
  interleaveSuggestions,
  type ProductDetailsById,
} from "./home-v2";

function productSuggestion(
  overrides: Partial<FindNextProductSuggestion> & Pick<FindNextProductSuggestion, "product_id">,
): FindNextProductSuggestion {
  const { product_id, ...rest } = overrides;
  return {
    kind: "product",
    source: "catalog",
    product_id,
    name: product_id,
    brand: null,
    product_type: "bourbon",
    suggestion_kind: "hunt_next",
    rationale: undefined,
    ...rest,
  };
}

function detail(overrides: Partial<HomeProductDetail> & Pick<HomeProductDetail, "product_id">): HomeProductDetail {
  const { product_id, ...rest } = overrides;
  return {
    product_id,
    image_url: null,
    tier: null,
    ...rest,
  };
}

describe("interleaveSuggestions", () => {
  it("alternates bourbon and cigar suggestions while preserving order within each type", () => {
    const bourbons = ["b1", "b2", "b3"].map((id) => productSuggestion({ product_id: id }));
    const cigars = ["c1", "c2"].map((id) => productSuggestion({ product_id: id, product_type: "cigar" }));

    expect(interleaveSuggestions(bourbons, cigars).map((item) => item.product_id)).toEqual([
      "b1",
      "c1",
      "b2",
      "c2",
      "b3",
    ]);
  });
});

describe("buildHomeV2Sections", () => {
  it("splits owned picks into Try Next and catalog picks into Hunt Next", () => {
    const suggestions: FindNextSuggestions = {
      pairing: [],
      pour: [
        productSuggestion({
          product_id: "owned-bourbon",
          source: "cellar",
          suggestion_kind: "try_tonight",
        }),
        productSuggestion({
          product_id: "hunt-bourbon",
          source: "catalog",
          suggestion_kind: "hunt_next",
        }),
      ],
      smoke: [
        productSuggestion({
          product_id: "owned-cigar",
          source: "cellar",
          product_type: "cigar",
          suggestion_kind: "try_tonight",
        }),
        productSuggestion({
          product_id: "hunt-cigar",
          source: "catalog",
          product_type: "cigar",
          suggestion_kind: "hunt_next",
        }),
      ],
    };

    const details: ProductDetailsById = {
      "owned-bourbon": detail({ product_id: "owned-bourbon", image_url: "/owned-bourbon.png" }),
      "hunt-bourbon": detail({ product_id: "hunt-bourbon", image_url: "/hunt-bourbon.png", tier: 4 }),
      "owned-cigar": detail({ product_id: "owned-cigar", image_url: "/owned-cigar.png" }),
      "hunt-cigar": detail({ product_id: "hunt-cigar", image_url: "/hunt-cigar.png" }),
    };

    const sections = buildHomeV2Sections({
      suggestions,
      detailsById: details,
      maxCatalogTier: 5,
    });

    expect(sections.tryNext.bourbons.map((item) => item.product_id)).toEqual(["owned-bourbon"]);
    expect(sections.tryNext.cigars.map((item) => item.product_id)).toEqual(["owned-cigar"]);
    expect(sections.huntNext.map((item) => item.product_id)).toEqual(["hunt-bourbon", "hunt-cigar"]);
  });

  it("filters hunt-next bourbons above the member tier cap but keeps cigars and unknown tiers", () => {
    const suggestions: FindNextSuggestions = {
      pairing: [],
      pour: [
        productSuggestion({ product_id: "common-bourbon", source: "catalog" }),
        productSuggestion({ product_id: "lottery-bourbon", source: "catalog" }),
        productSuggestion({ product_id: "unknown-tier-bourbon", source: "catalog" }),
      ],
      smoke: [productSuggestion({ product_id: "hunt-cigar", source: "catalog", product_type: "cigar" })],
    };

    const details: ProductDetailsById = {
      "common-bourbon": detail({ product_id: "common-bourbon", tier: 3 }),
      "lottery-bourbon": detail({ product_id: "lottery-bourbon", tier: 5 }),
      "unknown-tier-bourbon": detail({ product_id: "unknown-tier-bourbon", tier: null }),
      "hunt-cigar": detail({ product_id: "hunt-cigar", tier: null }),
    };

    const sections = buildHomeV2Sections({
      suggestions,
      detailsById: details,
      maxCatalogTier: 3,
    });

    expect(sections.huntNext.map((item) => item.product_id)).toEqual([
      "common-bourbon",
      "hunt-cigar",
      "unknown-tier-bourbon",
    ]);
  });

  it("derives rarity stamps from bourbon tier only", () => {
    const suggestions: FindNextSuggestions = {
      pairing: [],
      pour: [
        productSuggestion({ product_id: "allocated-bourbon", source: "catalog" }),
        productSuggestion({ product_id: "lottery-bourbon", source: "catalog" }),
      ],
      smoke: [productSuggestion({ product_id: "hunt-cigar", source: "catalog", product_type: "cigar" })],
    };

    const details: ProductDetailsById = {
      "allocated-bourbon": detail({ product_id: "allocated-bourbon", tier: 4 }),
      "lottery-bourbon": detail({ product_id: "lottery-bourbon", tier: 5 }),
      "hunt-cigar": detail({ product_id: "hunt-cigar", tier: null }),
    };

    const sections = buildHomeV2Sections({
      suggestions,
      detailsById: details,
      maxCatalogTier: 5,
    });

    expect(sections.huntNext.map((item) => item.rarityLabel)).toEqual(["Allocated", null, "Lottery"]);
  });
});

describe("deriveHomeV2Visibility", () => {
  it("hides Try Next when the member has nothing on the Have shelf", () => {
    expect(
      deriveHomeV2Visibility({
        haveCount: 0,
        hasPreferences: true,
        tryNextCount: 2,
        huntNextCount: 3,
      }),
    ).toEqual({
      showTryNext: false,
      showHuntNext: true,
      showEmptyCta: false,
    });
  });

  it("shows a single empty CTA when there is no shelf signal, no preferences, and no hunt-next picks", () => {
    expect(
      deriveHomeV2Visibility({
        haveCount: 0,
        hasPreferences: false,
        tryNextCount: 0,
        huntNextCount: 0,
      }),
    ).toEqual({
      showTryNext: false,
      showHuntNext: false,
      showEmptyCta: true,
    });
  });
});
