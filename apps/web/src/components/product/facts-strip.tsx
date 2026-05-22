import type { ProductType } from "@/lib/wheel";

type Specs = Record<string, unknown>;

type FactsStripProps = {
  productType: ProductType;
  specs: Specs | null | undefined;
  /** Keys to exclude (typically what CONSTRUCTION already showed). */
  excludeKeys?: string[];
};

const PREFERRED_ORDER = [
  "price_usd",
  "year_made",
  "aging_period_years",
  "tier",
  "tall",
  "image_url",
  "source_id",
  "review_url",
  "review_published",
  "additional_notes",
  "tasting_notes_raw",
  "shelf",
  "in_cobb_collection",
  "whiskey_type",
];

// Renderers for the misc fields. Keeping each one short on purpose; the strip
// is for the dense-glance facts, not narrative.
const FORMATTERS: Record<string, (v: unknown) => string | null> = {
  price_usd: (v) => (typeof v === "number" ? `$${v}` : null),
  year_made: (v) => (typeof v === "number" ? String(v) : null),
  aging_period_years: (v) => (typeof v === "number" ? `${v}yr aged` : null),
  tier: (v) => (typeof v === "number" ? `Tier ${v}` : null),
  tall: (v) => (v ? "tall bottle" : null),
  in_cobb_collection: (v) => (v ? "Paul's shelf" : null),
  whiskey_type: (v) => (typeof v === "string" && v ? v : null),
};

const HIDE_KEYS = new Set([
  // Storage / linkback fields — never user-visible
  "image_url",
  "source_id",
  "review_url",
  "review_published",
  // Numeric enrichment scores — shown in depth view with labels, not here
  "body_score",
  "strength_score",
  "price_tier",
  // Raw text blobs — too long for a strip
  "tasting_notes_raw",
  "additional_notes",
  // Internal flags
  "shelf",
]);

/**
 * Dense single-line info strip for the leftover product facts (UX-3).
 * Renders dot-separated values: `$30 · 2022 · 4yr aged · Tier 1`.
 *
 * Pulled out of the old vertical "The Facts" list because it now sits below
 * the richer Construction panel and shouldn't compete visually.
 */
export function FactsStrip({
  productType: _productType,
  specs,
  excludeKeys = [],
}: FactsStripProps) {
  const exclude = new Set([...excludeKeys, ...HIDE_KEYS]);
  const entries = Object.entries((specs ?? {}) as Specs).filter(([k]) => !exclude.has(k));

  // Apply preferred order: known keys first, then anything else alphabetically.
  entries.sort((a, b) => {
    const ia = PREFERRED_ORDER.indexOf(a[0]);
    const ib = PREFERRED_ORDER.indexOf(b[0]);
    if (ia === -1 && ib === -1) return a[0].localeCompare(b[0]);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  const tokens = entries
    .map(([key, value]) => {
      if (value === null || value === undefined || value === "") return null;
      const fmt = FORMATTERS[key];
      if (fmt) return fmt(value);
      // Default: short key + value (skip booleans, objects)
      if (typeof value === "boolean") return value ? key.replace(/_/g, " ") : null;
      if (typeof value === "object") return null;
      return String(value);
    })
    .filter((t): t is string => t !== null && t.trim() !== "");

  if (tokens.length === 0) return null;

  return (
    <p className="text-xs text-foreground-muted leading-relaxed">
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
