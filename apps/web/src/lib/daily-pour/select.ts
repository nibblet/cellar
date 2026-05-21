/**
 * Deterministic per-member, per-day pick from a candidate pool.
 *
 * The seed is (memberId, YYYY-MM-DD). Same seed + same pool → same pick. This
 * is the rotation contract: the same member sees the same pour all day, and
 * tomorrow they'll see a new one if the pool hasn't changed. Different
 * members on the same day land on different picks (most of the time).
 *
 * Hash chosen for stability and zero-dependency: FNV-1a 32-bit. We don't need
 * cryptographic spread; we just need a deterministic modulo over a small pool.
 */

export type DailyPourSeed = {
  memberId: string;
  date: string; // YYYY-MM-DD
};

export function seedKey(seed: DailyPourSeed): string {
  return `${seed.memberId}|${seed.date}`;
}

export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // 32-bit FNV prime multiply with overflow.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash >>> 0;
}

export function selectDailyPour<T>(seed: DailyPourSeed, candidates: T[]): T | null {
  if (candidates.length === 0) return null;
  const idx = fnv1a32(seedKey(seed)) % candidates.length;
  return candidates[idx];
}

/**
 * Today as YYYY-MM-DD in UTC. UTC is deliberate — local-time rotation across
 * a club spanning multiple time zones would produce inconsistent picks among
 * members on the same calendar date. A 24h slice in UTC is the simplest
 * stable answer; revisit when the club has international members.
 */
export function todayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
