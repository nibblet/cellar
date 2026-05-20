import bourbonWheelJson from "./data/bourbon-wheel-v1.json";
import cigarWheelJson from "./data/cigar-wheel-v1.json";
import type { FlavorWheel, ProductType } from "./types";

const wheels: Record<ProductType, FlavorWheel> = {
  cigar: cigarWheelJson as FlavorWheel,
  bourbon: bourbonWheelJson as FlavorWheel,
};

/**
 * The active flavor wheel for a given product type. In v1 there's one active
 * wheel per type; future versions will be loaded from the flavor_wheels table
 * with a fallback to these bundled copies.
 */
export function getWheel(type: ProductType): FlavorWheel {
  return wheels[type];
}

/**
 * Lookup a leaf by id. Throws if id is not in the wheel — wheel ids are stable
 * identifiers; an unknown id is a bug, not user input.
 */
export function getLeaf(type: ProductType, leafId: string) {
  const wheel = getWheel(type);
  const leaf = wheel.leaves.find((l) => l.id === leafId);
  if (!leaf) {
    throw new Error(`Unknown leaf id "${leafId}" in ${type} wheel v${wheel.version}`);
  }
  return leaf;
}
