export type ReleaseLabelSource = "vision" | "member" | "migration";

export type ParsedReleaseLabel = {
  release_label: string | null;
  release_year: number | null;
};

const YEAR_PATTERN = /\b(?:'?(\d{2})|'(\d{2})|(\d{4}))\b/;

/**
 * Normalize a raw release label and extract a calendar year when present.
 * Handles "2021", "21", "BTAC '22", "Batch 22F" (no year), etc.
 */
export function parseReleaseLabel(raw: string | null | undefined): ParsedReleaseLabel {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) {
    return { release_label: null, release_year: null };
  }

  const year = extractReleaseYear(trimmed);
  return { release_label: trimmed, release_year: year };
}

function extractReleaseYear(label: string): number | null {
  const match = label.match(YEAR_PATTERN);
  if (!match) return null;

  const fourDigit = match[3];
  if (fourDigit) {
    const year = Number.parseInt(fourDigit, 10);
    return year >= 1900 && year <= 2100 ? year : null;
  }

  const twoDigit = match[1] ?? match[2];
  if (!twoDigit) return null;

  const n = Number.parseInt(twoDigit, 10);
  if (Number.isNaN(n)) return null;

  // Bourbons: 00–30 → 2000s, 31–99 → 1900s (covers BTAC back to 1990s).
  const year = n <= 30 ? 2000 + n : 1900 + n;
  return year >= 1990 && year <= 2100 ? year : null;
}

export function releasePatternPrompt(pattern: string | null | undefined): string | null {
  switch (pattern) {
    case "year":
      return "Which year? (e.g., 2021)";
    case "batch":
      return "Batch number? (optional)";
    case "pick":
      return "Store pick or barrel name? (optional)";
    default:
      return null;
  }
}
