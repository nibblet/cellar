import { fnv1a32 } from "@/lib/daily-pour/select";

/**
 * On-demand pick seed — same member + date + roll index always yields the
 * same pair. Increment rollIndex on each shuffle for a new selection.
 */
export type PickPourSeed = {
  memberId: string;
  date: string; // YYYY-MM-DD
  rollIndex: number;
};

export function pickPourSeedKey(seed: PickPourSeed): string {
  return `${seed.memberId}|${seed.date}|${seed.rollIndex}`;
}

export function selectPickPour<T>(seed: PickPourSeed, candidates: T[]): T | null {
  if (candidates.length === 0) return null;
  const idx = fnv1a32(pickPourSeedKey(seed)) % candidates.length;
  return candidates[idx];
}
