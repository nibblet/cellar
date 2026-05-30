/** Stable URL-safe slug from a brand name. e.g. "Oliva Cigar" → "oliva-cigar" */
export function makerSlug(brand: string): string {
  return brand
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
