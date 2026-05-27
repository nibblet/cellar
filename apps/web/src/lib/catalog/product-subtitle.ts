import { formatPriceBucket, normalizeProductSpecs } from "@/lib/catalog/normalize-specs";
import type { ProductType } from "@/lib/wheel";

/** Facts line under the product title (detail page + catalog browse). */
export function composeProductSubtitle(
  productType: ProductType,
  specs: Record<string, unknown>,
): string | null {
  const { priceBucket } = normalizeProductSpecs(productType, specs);
  const tokens: string[] = [];
  if (priceBucket != null) tokens.push(formatPriceBucket(priceBucket));
  if (productType === "cigar") {
    if (typeof specs.vitola === "string" && specs.vitola) tokens.push(specs.vitola);
    if (typeof specs.strength === "string" && specs.strength) tokens.push(specs.strength);
    if (typeof specs.country === "string" && specs.country) tokens.push(specs.country);
  } else {
    if (typeof specs.age_label === "string" && specs.age_label) {
      const age = specs.age_label;
      const needsSuffix = /^\d+(\.\d+)?$/.test(age);
      tokens.push(needsSuffix ? `${age}yr` : age);
    }
    if (typeof specs.proof === "number") tokens.push(`${specs.proof} proof`);
    if (typeof specs.expression_type === "string" && specs.expression_type)
      tokens.push(specs.expression_type);
  }
  return tokens.length > 0 ? tokens.join(" · ") : null;
}
