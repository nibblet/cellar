import type { ProductType } from "@/lib/wheel";

/** Club-validated entries sort above higher-scoring theoretical matches. */
export function sortClubValidatedFirst<T extends { clubValidated: boolean; score: number }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    if (a.clubValidated !== b.clubValidated) return a.clubValidated ? -1 : 1;
    return b.score - a.score;
  });
}

export function pairingIds(
  sourceType: ProductType,
  sourceId: string,
  candidateId: string,
): { cigar_id: string; bourbon_id: string } {
  return sourceType === "cigar"
    ? { cigar_id: sourceId, bourbon_id: candidateId }
    : { cigar_id: candidateId, bourbon_id: sourceId };
}
