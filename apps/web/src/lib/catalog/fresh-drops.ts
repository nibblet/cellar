const FRESH_DAYS = 60;

export function isProductFresh(
  createdAt: string | null | undefined,
  specs: Record<string, unknown> | null | undefined,
): boolean {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - FRESH_DAYS);

  const candidates: string[] = [];
  if (createdAt) candidates.push(createdAt);
  const enrichedAt = specs?.enriched_at;
  if (typeof enrichedAt === "string") candidates.push(enrichedAt);

  return candidates.some((value) => new Date(value) >= cutoff);
}
