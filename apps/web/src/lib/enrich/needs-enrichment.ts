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

/** Fields vision can read off a bottle label — not the Apify/specs-enrich pass. */
const VISION_ONLY_BOURBON_KEYS = new Set([
  "distillery",
  "age_years",
  "proof",
  "abv",
  "mash_bill",
]);

/** True when a capture-created product still lacks catalog data from the web pass. */
export function productNeedsCatalogEnrichment(args: {
  productType?: ProductType;
  source: string | null;
  specs: Record<string, unknown> | null;
  reviewCount: number;
  hasWheelVector: boolean;
}): boolean {
  const { productType, source, specs, reviewCount, hasWheelVector } = args;

  if (reviewCount === 0 && source === "ai") return true;
  if (reviewCount === 0 && hasVisionOnlySpecs(specs, productType)) return true;
  if (reviewCount > 0 && hasVisionOnlySpecs(specs, productType)) return true;
  if (reviewCount > 0 && !hasWheelVector) return true;
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
      if (!VISION_ONLY_BOURBON_KEYS.has(key)) return false;
    }
    return true;
  }

  for (const [key, value] of Object.entries(specs)) {
    if (!VISION_ONLY_CIGAR_KEYS.has(key)) return false;
    if (value === null || value === undefined || value === "") continue;
    if (key === "wrapper_color" && typeof value === "string" && /appearance/i.test(value)) {
      continue;
    }
    if (value !== null && value !== undefined && value !== "") return false;
  }
  return true;
}
