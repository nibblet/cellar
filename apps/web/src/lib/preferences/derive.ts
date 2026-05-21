/**
 * Pure derivation helpers: collapse the raw catalog vocabulary into the
 * narrower preference vocabulary used by member_preferences.
 *
 * Each helper is a many-to-one map that handles the catalog's real-world
 * messiness (mixed casing, regional prefixes, near-synonyms) without
 * dragging the messiness into the preference UI.
 */

import type { BourbonProofBand, BourbonStyle, CigarStrength, CigarWrapperBucket } from "./types";

/**
 * Map a raw `products.specs.strength` value to a CigarStrength.
 * Returns null for unrecognized inputs — callers treat that as "unknown
 * strength" and skip matching against the member's strength prefs.
 */
export function normalizeCigarStrength(raw: string | null | undefined): CigarStrength | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  switch (v) {
    case "mild":
      return "mild";
    case "mild-medium":
    case "mild to medium":
    case "mild/medium":
      return "mild-medium";
    case "medium":
      return "medium";
    case "medium-full":
    case "medium to full":
    case "medium/full":
      return "medium-full";
    case "full":
    case "full-bodied":
      return "full";
    default:
      return null;
  }
}

/**
 * Bucket a raw wrapper string into one of 8 grouped buckets.
 *
 * Ordering matters here: more specific tokens come first (San Andrés is a
 * kind of Maduro to some, but it's its own bucket here so check before the
 * generic Maduro fallback). Oscuro is darker than Maduro, also gets its own
 * bucket so Habano Oscuro doesn't quietly collapse into Habano.
 */
export function bucketCigarWrapper(raw: string | null | undefined): CigarWrapperBucket | null {
  if (!raw) return null;
  const v = raw.toLowerCase();

  if (v.includes("san andres") || v.includes("san andrés") || v.includes("mexican san")) {
    return "san-andres";
  }
  if (v.includes("oscuro")) return "oscuro";
  if (v.includes("broadleaf") || v.includes("maduro")) return "maduro";
  if (v.includes("corojo")) return "corojo";
  if (v.includes("sumatra")) return "sumatra";
  if (v.includes("cameroon")) return "cameroon";
  if (v.includes("habano")) return "habano";
  if (v.includes("connecticut")) return "connecticut";

  return null;
}

/**
 * Derive bourbon style tags from the product's specs. A bourbon can carry
 * multiple style tags ("wheated", "single-barrel" both apply to a wheated
 * single-barrel release), and matching is OR across the union.
 *
 * Heuristics chosen for catalog coverage, not encyclopedic accuracy:
 *   - "Rye" if whiskey_type contains rye or mash bill names rye as the
 *     primary grain.
 *   - "Wheated" if mash bill names wheat (and isn't a rye whiskey).
 *   - "High-rye" if rye content > 20% in the mash bill (bourbons with a rye
 *     grain ratio meaningfully above the ~10% baseline).
 *   - "Bourbon" when whiskey_type explicitly says bourbon.
 *   - "Bottled-in-Bond" if any spec field surfaces BiB / Bonded.
 *   - "Single Barrel" if a spec field surfaces single barrel.
 */
export function deriveBourbonStyles(
  specs: Record<string, unknown> | null | undefined,
): BourbonStyle[] {
  if (!specs) return [];

  const tags = new Set<BourbonStyle>();
  const whiskeyType = stringSpec(specs, "whiskey_type")?.toLowerCase() ?? "";
  const mashBill = stringSpec(specs, "mash_bill")?.toLowerCase() ?? "";
  const additional =
    `${stringSpec(specs, "additional_notes") ?? ""} ${stringSpec(specs, "tasting_notes_raw") ?? ""}`.toLowerCase();
  const styleFamily = stringSpec(specs, "style_family")?.toUpperCase() ?? "";
  const nameLike = `${stringSpec(specs, "name") ?? ""}`.toLowerCase();

  // Rye comes first — a rye whiskey is not a bourbon.
  if (whiskeyType.includes("rye") || styleFamily === "RYE" || /\brye\b/.test(mashBill)) {
    // Confirm "Rye" only when the mash bill / type clearly leads with rye,
    // not when it's a bourbon with rye in the grain list.
    if (whiskeyType.includes("rye") || styleFamily === "RYE") tags.add("rye");
  }

  if (whiskeyType.includes("bourbon") || styleFamily.startsWith("B")) {
    tags.add("bourbon");
  }

  // Wheated: wheat in mash bill, not a rye whiskey.
  if (
    !tags.has("rye") &&
    (mashBill.includes("wheat") || styleFamily === "BWH" || nameLike.includes("wheat"))
  ) {
    tags.add("wheated");
  }

  // High-rye: explicit > 20% rye in mash bill text, or BHR family code.
  if (styleFamily === "BHR") tags.add("high-rye");
  const ryePctMatch = mashBill.match(/(\d{1,2})\s*%?\s*rye/);
  if (ryePctMatch && Number.parseInt(ryePctMatch[1], 10) >= 20) tags.add("high-rye");

  // Bottled-in-Bond.
  if (/\b(bottled[\s-]?in[\s-]?bond|bonded|bib)\b/.test(additional + " " + nameLike)) {
    tags.add("bottled-in-bond");
  }

  // Single Barrel.
  if (/\bsingle[\s-]?barrel\b/.test(additional + " " + nameLike)) {
    tags.add("single-barrel");
  }

  return [...tags];
}

/**
 * Map a numeric proof to its band.
 */
export function deriveProofBand(proof: number | null | undefined): BourbonProofBand | null {
  if (proof == null || Number.isNaN(proof)) return null;
  if (proof <= 90) return "low";
  if (proof >= 110) return "high";
  return "mid";
}

function stringSpec(specs: Record<string, unknown>, key: string): string | null {
  const v = specs[key];
  return typeof v === "string" ? v : null;
}
