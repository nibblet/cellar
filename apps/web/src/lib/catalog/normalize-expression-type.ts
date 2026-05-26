/**
 * Collapse comma-separated enrichment expression_type strings to one primary token.
 * Finishes and secondary descriptors become modifiers (curated_expression supplements).
 */

const SERIES_TOKENS = [
  "single barrel",
  "small batch",
  "cask strength",
  "barrel proof",
  "barrel strength",
  "full proof",
  "bottled-in-bond",
  "straight bourbon",
  "straight rye",
  "limited edition",
  "four grain",
] as const;

const FINISH_HINT =
  /\b(finished|finish|cask finished|barrel finished|toasted|infused|wine|cask)\b/i;

export type NormalizedExpressionType = {
  expression_type: string | null;
  expression_modifier: string | null;
  needs_review: boolean;
};

function splitParts(raw: string): string[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function pickSeriesToken(parts: string[]): string | null {
  for (const token of SERIES_TOKENS) {
    const match = parts.find(
      (part) =>
        part.toLowerCase() === token ||
        part.toLowerCase().includes(token) ||
        token.includes(part.toLowerCase()),
    );
    if (match) return match;
  }
  return null;
}

function titleCaseToken(token: string): string {
  return token
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/** Map matched substring to a canonical primary label when obvious. */
function canonicalPrimary(token: string): string {
  const lower = token.toLowerCase();
  if (lower.includes("single barrel")) return "Single Barrel";
  if (lower.includes("small batch")) return "Small Batch";
  if (lower.includes("cask strength") || lower.includes("barrel strength")) return "Cask Strength";
  if (lower.includes("barrel proof")) return "Barrel Proof";
  if (lower.includes("full proof")) return "Full Proof";
  if (lower.includes("bottled-in-bond") || lower.includes("bottled in bond"))
    return "Bottled-in-Bond";
  if (lower.includes("straight rye")) return "Straight Rye";
  if (lower.includes("straight bourbon")) return "Straight Bourbon";
  if (lower.includes("limited edition")) return "Limited Edition";
  if (lower.includes("four grain")) return "Four Grain";
  return titleCaseToken(token);
}

export function normalizeExpressionType(raw: string | null | undefined): NormalizedExpressionType {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) {
    return { expression_type: null, expression_modifier: null, needs_review: false };
  }

  if (!trimmed.includes(",")) {
    return { expression_type: trimmed, expression_modifier: null, needs_review: false };
  }

  const parts = splitParts(trimmed);
  const series = pickSeriesToken(parts);
  if (series) {
    const rest = parts.filter((part) => part !== series);
    return {
      expression_type: canonicalPrimary(series),
      expression_modifier: rest.length > 0 ? rest.join(", ") : null,
      needs_review: rest.length > 1,
    };
  }

  const finishes = parts.filter((part) => FINISH_HINT.test(part));
  const nonFinishes = parts.filter((part) => !FINISH_HINT.test(part));

  if (finishes.length > 0 && nonFinishes.length === 1) {
    const primary = nonFinishes[0];
    if (!primary) {
      return { expression_type: null, expression_modifier: parts.join(", "), needs_review: true };
    }
    return {
      expression_type: titleCaseToken(primary),
      expression_modifier: finishes.join(", "),
      needs_review: false,
    };
  }

  if (finishes.length === parts.length) {
    return {
      expression_type: null,
      expression_modifier: parts.join(", "),
      needs_review: true,
    };
  }

  const fallback = parts[0];
  if (!fallback) {
    return { expression_type: null, expression_modifier: null, needs_review: false };
  }

  return {
    expression_type: titleCaseToken(fallback),
    expression_modifier: parts.slice(1).join(", ") || null,
    needs_review: parts.length > 2,
  };
}
