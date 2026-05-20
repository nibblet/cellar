/**
 * Flavor wheel schema. Mirrors data/flavor-wheels/wheel-schema.md exactly.
 * If you change the shape here, bump the wheel JSON version and reseed.
 */

export type ProductType = "cigar" | "bourbon";

export const PAIRING_TRAITS = [
  "sweet",
  "creamy",
  "warm",
  "sharp",
  "woody",
  "earthy",
  "roasted",
  "bright",
  "dry",
  "fruity",
] as const;

export type PairingTrait = (typeof PAIRING_TRAITS)[number];

export type WheelCategory = {
  id: string;
  label: string;
  order: number;
  description: string;
};

export type WheelLeaf = {
  id: string;
  label: string;
  category_id: string;
  synonyms: string[];
  common_in_reviews: boolean;
  pairing_traits: PairingTrait[];
};

export type FlavorWheel = {
  version: string;
  type: ProductType;
  updated: string;
  categories: WheelCategory[];
  leaves: WheelLeaf[];
};

/**
 * Sparse score map: { leaf_id: 0-5 }. Only leaves with score >= 1 stored.
 */
export type WheelVector = Record<string, number>;

/**
 * Normalized rollup of a WheelVector to pairing traits: { trait: 0-1 }.
 */
export type TraitVector = Record<PairingTrait, number>;
