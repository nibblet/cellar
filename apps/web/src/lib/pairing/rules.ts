import type { TraitVector } from "@/lib/wheel";

/**
 * One firing of a pairing rule. The scoring layer sums `contribution` across
 * all rules that fired; the prose layer reads `reason` strings to compose the
 * Bartender's explanation.
 */
export type RuleResult = {
  rule: string;
  contribution: number; // signed; positive favors pair, negative discourages
  reason: string; // short, lowercase clause; consumed by both engine + LLM
};

export type PairingRule = (cigar: TraitVector, bourbon: TraitVector) => RuleResult | null;

/**
 * Thresholds tuned for the v0.1 wheel. "Moderate" presence of a trait means
 * 2-3 strong leaves fired in that family; "high" means a profile dominated
 * by that trait. Numbers come from rollUpTraits: a leaf at intensity 5
 * contributes 5/(num_leaves_carrying_trait * 5).
 *
 * Revisit these once we have ~30 days of real tasting data.
 */
const MOD = 0.15;
const HIGH = 0.3;

function avg(...values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * A sweet+creamy bourbon rounds the edges of an earthy/dry cigar. The
 * classic "Padron meets Weller" pairing math.
 */
const ruleSweetEarthBalance: PairingRule = (cigar, bourbon) => {
  const cigarEarth = avg(cigar.earthy, cigar.dry);
  const bourbonRound = avg(bourbon.sweet, bourbon.creamy);
  if (cigarEarth >= MOD && bourbonRound >= MOD) {
    return {
      rule: "sweet-earth-balance",
      contribution: 22,
      reason: "the earthy, dry cigar finds rounding in a sweet, creamy bourbon",
    };
  }
  return null;
};

/**
 * Roasted on both sides harmonizes — coffee/char cigars love coffee/char
 * bourbons.
 */
const ruleRoastedHarmony: PairingRule = (cigar, bourbon) => {
  if (cigar.roasted >= MOD && bourbon.roasted >= MOD) {
    return {
      rule: "roasted-harmony",
      contribution: 16,
      reason: "shared roast and char ground the pair in the same register",
    };
  }
  return null;
};

/**
 * Warm baking spice on both sides (cinnamon, clove) — feels like fall.
 */
const ruleWarmHarmony: PairingRule = (cigar, bourbon) => {
  if (cigar.warm >= MOD && bourbon.warm >= MOD) {
    return {
      rule: "warm-harmony",
      contribution: 14,
      reason: "warm baking spice shows up in both, like a fire in autumn",
    };
  }
  return null;
};

/**
 * Wood pairs with wood — cedar/oak cigar with charred-oak bourbon.
 */
const ruleWoodyHarmony: PairingRule = (cigar, bourbon) => {
  if (cigar.woody >= MOD && bourbon.woody >= MOD) {
    return {
      rule: "woody-harmony",
      contribution: 12,
      reason: "the wood on both sides reinforces without crowding",
    };
  }
  return null;
};

/**
 * A bright/citrus bourbon lifts a heavy earthy cigar.
 */
const ruleBrightLift: PairingRule = (cigar, bourbon) => {
  if (cigar.earthy >= HIGH && bourbon.bright >= MOD) {
    return {
      rule: "bright-lift",
      contribution: 10,
      reason: "the bourbon's citrus and floral lift the cigar's heavier earth",
    };
  }
  return null;
};

/**
 * Too much sharpness on both sides clashes — black pepper cigar with
 * high-rye bourbon both gunning for the same nerves.
 */
const ruleSharpClash: PairingRule = (cigar, bourbon) => {
  if (cigar.sharp >= HIGH && bourbon.sharp >= HIGH) {
    return {
      rule: "sharp-clash",
      contribution: -18,
      reason: "both lean sharp; they fight for the same nerves",
    };
  }
  return null;
};

/**
 * Two very sweet profiles together cloy. Cocoa-bomb cigar with a syrupy
 * wheater can be too much of one note.
 */
const ruleCloying: PairingRule = (cigar, bourbon) => {
  if (cigar.sweet >= HIGH && bourbon.sweet >= HIGH) {
    return {
      rule: "cloying-sweet",
      contribution: -12,
      reason: "both lean sweet; the pair risks tipping into cloying",
    };
  }
  return null;
};

/**
 * Fruity bourbon brightens a dry, tobacco-forward cigar.
 */
const ruleFruityCounterpoint: PairingRule = (cigar, bourbon) => {
  if (cigar.dry >= MOD && bourbon.fruity >= MOD) {
    return {
      rule: "fruity-counterpoint",
      contribution: 10,
      reason: "the bourbon's dried fruit cuts the cigar's dryness with a wink",
    };
  }
  return null;
};

export const PAIRING_RULES: PairingRule[] = [
  ruleSweetEarthBalance,
  ruleRoastedHarmony,
  ruleWarmHarmony,
  ruleWoodyHarmony,
  ruleBrightLift,
  ruleSharpClash,
  ruleCloying,
  ruleFruityCounterpoint,
];

/**
 * Evaluate every rule against a (cigar, bourbon) trait pair. Returns only
 * the rules that fired, in declaration order.
 */
export function evaluatePairing(cigar: TraitVector, bourbon: TraitVector): RuleResult[] {
  return PAIRING_RULES.map((rule) => rule(cigar, bourbon)).filter(
    (r): r is RuleResult => r !== null,
  );
}
