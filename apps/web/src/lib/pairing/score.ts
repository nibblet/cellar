import type { TraitVector } from "@/lib/wheel";
import { evaluatePairing, type RuleResult } from "./rules";

const BASELINE = 50;
const MIN_SCORE = 0;
const MAX_SCORE = 100;

export type PairingScore = {
  score: number; // 0-100
  reasons: RuleResult[]; // rules that fired, in declaration order
};

/**
 * Sum every firing rule's contribution and clamp to 0-100, centered on 50.
 * Empty rule list (no traits in common) lands at the baseline.
 */
export function scorePair(cigar: TraitVector, bourbon: TraitVector): PairingScore {
  const reasons = evaluatePairing(cigar, bourbon);
  const total = reasons.reduce((sum, r) => sum + r.contribution, 0);
  const score = Math.max(MIN_SCORE, Math.min(MAX_SCORE, BASELINE + total));
  return { score, reasons };
}
