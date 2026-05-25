import {
  formatPriceBucket,
  formatRarityLabel,
  NORMALIZED_SPEC_KEYS,
  normalizeProductSpecs,
} from "@/lib/catalog/normalize-specs";
import type { ProductType } from "@/lib/wheel";

type Specs = Record<string, unknown>;

type FactsStripProps = {
  productType: ProductType;
  specs: Specs | null | undefined;
  /** Keys to exclude (typically what CONSTRUCTION already showed). */
  excludeKeys?: string[];
};

const PREFERRED_ORDER = ["year_made", "series", "tall", "in_cobb_collection"];

const FORMATTERS: Record<string, (v: unknown) => string | null> = {
  year_made: (v) => (typeof v === "number" ? String(v) : null),
  tall: (v) => (v ? "tall bottle" : null),
  in_cobb_collection: (v) => (v ? "Paul's shelf" : null),
  series: (v) => (typeof v === "string" && v ? `${v} series` : null),
};

const HIDE_KEYS = new Set([
  ...NORMALIZED_SPEC_KEYS,
  "image_url",
  "source_id",
  "review_url",
  "review_published",
  "body_score",
  "strength_score",
  "rating",
  "score",
  "length_inches",
  "length",
  "ring_gauge",
  "dimension",
  "size",
  "age_years",
  "age_label",
  "aging_period_years",
  "abv",
  "whiskey_type",
  "style_family",
  "tasting_notes_raw",
  "additional_notes",
  "flavor_profile_raw",
  "shelf",
  "curation_notes",
  "enrichment_pending",
  "club_staple",
  "expression_type",
  "factory",
  "body",
]);

/**
 * Dense single-line info strip for the leftover product facts (UX-3).
 * Renders dot-separated values: `$$$ · Uncommon · Paul's shelf`.
 */
export function FactsStrip({ productType, specs, excludeKeys = [] }: FactsStripProps) {
  const normalized = normalizeProductSpecs(productType, specs);
  const exclude = new Set([...excludeKeys, ...HIDE_KEYS]);
  const entries = Object.entries((specs ?? {}) as Specs).filter(([k]) => !exclude.has(k));

  entries.sort((a, b) => {
    const ia = PREFERRED_ORDER.indexOf(a[0]);
    const ib = PREFERRED_ORDER.indexOf(b[0]);
    if (ia === -1 && ib === -1) return a[0].localeCompare(b[0]);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  const tokens: string[] = [];

  if (normalized.priceBucket != null) {
    tokens.push(formatPriceBucket(normalized.priceBucket));
  }

  if (normalized.availabilityLabel != null) {
    tokens.push(normalized.availabilityLabel);
  } else if (normalized.rarityLabel != null) {
    tokens.push(formatRarityLabel(normalized.rarityLabel));
  }

  for (const [key, value] of entries) {
    if (value === null || value === undefined || value === "") continue;
    const fmt = FORMATTERS[key];
    if (fmt) {
      const token = fmt(value);
      if (token) tokens.push(token);
      continue;
    }
    if (typeof value === "boolean") {
      const token = value ? key.replace(/_/g, " ") : null;
      if (token) tokens.push(token);
      continue;
    }
    if (typeof value === "string") tokens.push(value);
  }

  if (tokens.length === 0) return null;

  return (
    <p className="text-xs text-foreground-muted leading-relaxed break-words">
      {tokens.map((token, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: cosmetic dot-separated list
        <span key={`${token}-${i}`}>
          {token}
          {i < tokens.length - 1 ? <span className="mx-2 text-foreground-subtle">·</span> : null}
        </span>
      ))}
    </p>
  );
}
