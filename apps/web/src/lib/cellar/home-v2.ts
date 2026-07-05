import type { FindNextProductSuggestion, FindNextSuggestions } from "@/lib/find-next/types";

export type HomeProductDetail = {
  product_id: string;
  image_url: string | null;
  tier: number | null;
};

export type ProductDetailsById = Record<string, HomeProductDetail>;

export type HomeTryNextPick = FindNextProductSuggestion & {
  image_url: string | null;
};

export type HomeHuntNextPick = FindNextProductSuggestion & {
  image_url: string | null;
  tier: number | null;
  rarityLabel: "Allocated" | "Lottery" | null;
};

export type HomeV2Sections = {
  tryNext: {
    bourbons: HomeTryNextPick[];
    cigars: HomeTryNextPick[];
  };
  huntNext: HomeHuntNextPick[];
};

export type HomeV2Visibility = {
  showTryNext: boolean;
  showHuntNext: boolean;
  showEmptyCta: boolean;
};

type BuildHomeV2SectionsParams = {
  suggestions: FindNextSuggestions;
  detailsById: ProductDetailsById;
  maxCatalogTier: number;
};

export function interleaveSuggestions<T>(first: T[], second: T[]): T[] {
  const merged: T[] = [];
  const max = Math.max(first.length, second.length);

  for (let index = 0; index < max; index += 1) {
    if (index < first.length) merged.push(first[index]);
    if (index < second.length) merged.push(second[index]);
  }

  return merged;
}

export function buildHomeV2Sections({
  suggestions,
  detailsById,
  maxCatalogTier,
}: BuildHomeV2SectionsParams): HomeV2Sections {
  const tryNextBourbons = enrichTryNextPicks(suggestions.pour, detailsById);
  const tryNextCigars = enrichTryNextPicks(suggestions.smoke, detailsById);

  const huntNextBourbons = enrichHuntNextPicks(suggestions.pour, detailsById, maxCatalogTier);
  const huntNextCigars = enrichHuntNextPicks(suggestions.smoke, detailsById, maxCatalogTier);

  return {
    tryNext: {
      bourbons: tryNextBourbons,
      cigars: tryNextCigars,
    },
    huntNext: interleaveSuggestions(huntNextBourbons, huntNextCigars),
  };
}

export function deriveHomeV2Visibility(params: {
  haveCount: number;
  hasPreferences: boolean;
  tryNextCount: number;
  huntNextCount: number;
}): HomeV2Visibility {
  const showTryNext = params.haveCount > 0 && params.tryNextCount > 0;
  const showHuntNext = params.huntNextCount > 0;
  const showEmptyCta = !showTryNext && !showHuntNext && !params.hasPreferences;

  return {
    showTryNext,
    showHuntNext,
    showEmptyCta,
  };
}

function enrichTryNextPicks(
  suggestions: FindNextProductSuggestion[],
  detailsById: ProductDetailsById,
): HomeTryNextPick[] {
  return suggestions
    .filter((item) => item.source === "cellar")
    .map((item) => ({
      ...item,
      image_url: detailsById[item.product_id]?.image_url ?? null,
    }));
}

function enrichHuntNextPicks(
  suggestions: FindNextProductSuggestion[],
  detailsById: ProductDetailsById,
  maxCatalogTier: number,
): HomeHuntNextPick[] {
  return suggestions
    .filter((item) => item.source === "catalog")
    .map((item) => {
      const detail = detailsById[item.product_id];
      const tier = detail?.tier ?? null;
      return {
        ...item,
        image_url: detail?.image_url ?? null,
        tier,
        rarityLabel: rarityLabelForTier(item.product_type, tier),
      };
    })
    .filter((item) => shouldIncludeInHuntNext(item, maxCatalogTier));
}

function shouldIncludeInHuntNext(item: HomeHuntNextPick, maxCatalogTier: number): boolean {
  if (item.product_type !== "bourbon") return true;
  if (item.tier === null) return true;
  return item.tier <= maxCatalogTier;
}

function rarityLabelForTier(
  productType: FindNextProductSuggestion["product_type"],
  tier: number | null,
): "Allocated" | "Lottery" | null {
  if (productType !== "bourbon" || tier === null) return null;
  if (tier >= 5) return "Lottery";
  if (tier === 4) return "Allocated";
  return null;
}
