import type { CellarSnapshot } from "./types";

/**
 * Per-viewer ranking overlay for pairing candidates.
 *
 * Applied at read time — never mutates pairings_cache. The universal cached
 * score is the club view; this is a viewer-specific nudge toward products
 * they've tried or currently have.
 *
 * Scale is calibrated to be subtle: max +10 on a 0–100 base score. The
 * engine's actual pairing signal should dominate; this just breaks ties in
 * favor of familiar territory.
 */
export function applyCellarBias(
  baseScore: number,
  snapshot: CellarSnapshot,
  cigarId: string,
  bourbonId: string,
): number {
  let bonus = 0;
  if (snapshot.tried.has(cigarId)) bonus += 3;
  if (snapshot.tried.has(bourbonId)) bonus += 3;
  if (snapshot.have.has(cigarId)) bonus += 2;
  if (snapshot.have.has(bourbonId)) bonus += 2;
  return Math.min(100, baseScore + bonus);
}
