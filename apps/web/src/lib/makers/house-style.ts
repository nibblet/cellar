import { dominantTraits } from "@/lib/taste/vector";
import type { TraitVector } from "@/lib/wheel";

/**
 * Derive a one-line house-style read from an aggregated trait vector.
 * e.g. "Oliva leans sweet, woody, earthy."
 */
export function deriveHouseStyleLine(vector: TraitVector, makerName: string): string {
  const traits = dominantTraits(vector);
  if (traits.length === 0) return "";

  const [primary, ...rest] = traits;
  const tagline =
    rest.length > 0 ? `${primary}, ${rest.slice(0, 2).join(", ")}` : primary;

  return `${makerName} leans ${tagline}.`;
}
