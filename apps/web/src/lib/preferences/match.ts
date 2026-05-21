/**
 * Decide whether a product matches a member's preferences.
 *
 * Semantics (locked 2026-05-21): binary OR across all four axes. One trait
 * suffices — if the wrapper bucket matches, the strength doesn't have to.
 * Empty preferences never match (the badge stays dark). Members with empty
 * prefs are intentionally invisible to the FOR YOU surface.
 *
 * Lightweight by design: the badge surfaces in the feed, which paints many
 * cards at once. No DB joins inside this function — caller passes plain
 * specs.
 */

import {
  bucketCigarWrapper,
  deriveBourbonStyles,
  deriveProofBand,
  normalizeCigarStrength,
} from "./derive";
import type { MemberPreferences } from "./types";
import { hasAnyPreferences } from "./types";

type ProductLite = {
  type: "cigar" | "bourbon";
  specs: Record<string, unknown> | null | undefined;
};

export function productMatchesPreferences(product: ProductLite, prefs: MemberPreferences): boolean {
  if (!hasAnyPreferences(prefs)) return false;

  if (product.type === "cigar") {
    const strength = normalizeCigarStrength(stringSpec(product.specs, "strength"));
    if (strength && prefs.cigar_strengths.includes(strength)) return true;

    const wrapper = bucketCigarWrapper(stringSpec(product.specs, "wrapper"));
    if (wrapper && prefs.cigar_wrappers.includes(wrapper)) return true;

    return false;
  }

  // Bourbon
  const styles = deriveBourbonStyles(product.specs ?? null);
  for (const s of styles) {
    if (prefs.bourbon_styles.includes(s)) return true;
  }

  const proof = numberSpec(product.specs, "proof");
  const band = deriveProofBand(proof);
  if (band && prefs.bourbon_proof_bands.includes(band)) return true;

  return false;
}

function stringSpec(specs: Record<string, unknown> | null | undefined, key: string): string | null {
  if (!specs) return null;
  const v = specs[key];
  return typeof v === "string" ? v : null;
}

function numberSpec(specs: Record<string, unknown> | null | undefined, key: string): number | null {
  if (!specs) return null;
  const v = specs[key];
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
