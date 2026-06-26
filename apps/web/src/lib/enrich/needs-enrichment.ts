import type { ProductType } from "@/lib/wheel";

const VISION_ONLY_CIGAR_KEYS = new Set([
  "vitola",
  "country",
  "strength",
  "wrapper_color",
  "binder",
  "filler",
  "body",
]);

/** Fields vision can read off a bottle label — not the web enrichment pass. */
const VISION_ONLY_BOURBON_KEYS = new Set(["distillery", "age_years", "proof", "abv", "mash_bill"]);

/** Legacy Apify rows or a completed OpenAI web enrich pass. */
export function isCatalogWebEnriched(
  specs: Record<string, unknown> | null,
  legacyReviewCount: number,
): boolean {
  if (legacyReviewCount > 0) return true;
  return typeof specs?.web_enriched_at === "string" && specs.web_enriched_at.length > 0;
}

/** True when a capture-created product still lacks catalog data from the web pass. */
export function productNeedsCatalogEnrichment(args: {
  productType?: ProductType;
  source: string | null;
  specs: Record<string, unknown> | null;
  reviewCount: number;
  hasWheelVector: boolean;
}): boolean {
  const { productType, source, specs, reviewCount, hasWheelVector } = args;
  const enriched = isCatalogWebEnriched(specs, reviewCount);

  if (!enriched && source === "ai") return true;
  if (!enriched && hasVisionOnlySpecs(specs, productType)) return true;
  if (enriched && hasVisionOnlySpecs(specs, productType)) return true;
  // Legacy Apify rows may have reviews without a wheel pass; web enrich is one-shot.
  if (enriched && !hasWheelVector && reviewCount > 0) return true;
  return false;
}

function hasVisionOnlySpecs(
  specs: Record<string, unknown> | null,
  productType?: ProductType,
): boolean {
  if (!specs || Object.keys(specs).length === 0) return true;

  if (productType === "bourbon") {
    for (const [key, value] of Object.entries(specs)) {
      if (value === null || value === undefined || value === "") continue;
      if (
        key === "web_enriched_at" ||
        key === "enrichment_source" ||
        key === "enrichment_source_urls"
      ) {
        continue;
      }
      if (!VISION_ONLY_BOURBON_KEYS.has(key)) return false;
    }
    return true;
  }

  for (const [key, value] of Object.entries(specs)) {
    if (
      key === "web_enriched_at" ||
      key === "enrichment_source" ||
      key === "enrichment_source_urls"
    ) {
      continue;
    }
    if (!VISION_ONLY_CIGAR_KEYS.has(key)) return false;
    if (value === null || value === undefined || value === "") continue;
    if (key === "wrapper_color" && typeof value === "string" && /appearance/i.test(value)) {
      continue;
    }
    if (value !== null && value !== undefined && value !== "") return false;
  }
  return true;
}
