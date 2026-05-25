const VISION_ONLY_CIGAR_KEYS = new Set([
  "vitola",
  "country",
  "strength",
  "wrapper_color",
  "binder",
  "filler",
  "body",
]);

/** True when a capture-created product still lacks catalog data from the web pass. */
export function productNeedsCatalogEnrichment(args: {
  source: string | null;
  specs: Record<string, unknown> | null;
  reviewCount: number;
  hasWheelVector: boolean;
}): boolean {
  const { source, specs, reviewCount, hasWheelVector } = args;

  if (reviewCount === 0 && source === "ai") return true;
  if (reviewCount === 0 && hasVisionOnlySpecs(specs)) return true;
  if (reviewCount > 0 && hasVisionOnlySpecs(specs)) return true;
  if (reviewCount > 0 && !hasWheelVector) return true;
  return false;
}

function hasVisionOnlySpecs(specs: Record<string, unknown> | null): boolean {
  if (!specs || Object.keys(specs).length === 0) return true;

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
