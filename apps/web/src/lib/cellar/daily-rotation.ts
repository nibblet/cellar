import { fnv1a32 } from "@/lib/daily-pour/select";

export function rotateDaily<T>(items: T[], seed: string, limit: number): T[] {
  if (items.length === 0 || limit <= 0) return [];
  if (items.length <= limit) return items;
  const start = fnv1a32(seed) % items.length;
  const rotated: T[] = [];
  for (let i = 0; i < limit; i += 1) {
    rotated.push(items[(start + i) % items.length]);
  }
  return rotated;
}

export function deprioritizeRecent<T extends { product_id: string }>(
  items: T[],
  recentIds: Set<string>,
): T[] {
  const fresh: T[] = [];
  const recent: T[] = [];
  for (const item of items) {
    if (recentIds.has(item.product_id)) recent.push(item);
    else fresh.push(item);
  }
  return [...fresh, ...recent];
}
