/** Collapsed variant labels stored on the parent expression row. */
export const KNOWN_RELEASE_LABELS_KEY = "known_release_labels";

export function labelsFromSpecs(specs: Record<string, unknown> | null | undefined): string[] {
  const raw = specs?.[KNOWN_RELEASE_LABELS_KEY];
  if (Array.isArray(raw)) {
    return raw
      .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      .map((entry) => entry.trim());
  }

  const legacy = specs?.curation_release_label;
  if (typeof legacy === "string" && legacy.trim()) return [legacy.trim()];
  return [];
}

export function sortReleaseLabels(labels: string[]): string[] {
  return [...labels].sort((a, b) => {
    const ay = /^\d{4}$/.test(a) ? Number(a) : null;
    const by = /^\d{4}$/.test(b) ? Number(b) : null;
    if (ay != null && by != null) return by - ay;
    if (ay != null) return -1;
    if (by != null) return 1;
    return a.localeCompare(b, undefined, { numeric: true });
  });
}

export function mergeKnownReleaseLabels(existing: string[], added: string[]): string[] {
  const merged = new Set(existing.map((label) => label.trim()).filter(Boolean));
  for (const label of added) {
    const trimmed = label.trim();
    if (trimmed) merged.add(trimmed);
  }
  return sortReleaseLabels([...merged]);
}

export function collectKnownReleaseLabels(
  specs: Record<string, unknown> | null | undefined,
  memberLabels: Array<string | null | undefined>,
): string[] {
  return mergeKnownReleaseLabels(labelsFromSpecs(specs), memberLabels.filter(Boolean) as string[]);
}

export function releasePatternHeading(pattern: string | null | undefined): string | null {
  switch (pattern) {
    case "year":
      return "Known years";
    case "batch":
      return "Known batches & vintages";
    case "pick":
      return "Known picks";
    default:
      return "Known releases";
  }
}
