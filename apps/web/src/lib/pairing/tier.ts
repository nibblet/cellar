export type PairingTier = "fine" | "good" | "worth" | "curious";

const TIER_THRESHOLDS = [
  { min: 75, tier: "fine" as const },
  { min: 65, tier: "good" as const },
  { min: 55, tier: "worth" as const },
] as const;

export const PAIRING_TIER_LABEL: Record<PairingTier, string> = {
  fine: "Definite pair",
  good: "Good match",
  worth: "Worth a try",
  curious: "Curious pairing",
};

export function pairingTier(score: number): PairingTier {
  for (const { min, tier } of TIER_THRESHOLDS) {
    if (score >= min) return tier;
  }
  return "curious";
}

export function pairingTierLabel(score: number): string {
  return PAIRING_TIER_LABEL[pairingTier(score)];
}
