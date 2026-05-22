import { Card } from "@/components/primitives";
import type { ProductType } from "@/lib/wheel";

type Specs = Record<string, unknown>;

type ConstructionPanelProps = {
  productType: ProductType;
  specs: Specs | null | undefined;
};

type FieldDef = {
  /** Spec keys to try, in order. First defined-and-nonempty value wins. */
  keys: string[];
  label: string;
  formatter?: (v: unknown, specs: Specs) => string | null;
};

const CIGAR_FIELDS: FieldDef[] = [
  { keys: ["wrapper"], label: "Wrapper" },
  { keys: ["wrapper_color"], label: "Wrapper color" },
  { keys: ["binder"], label: "Binder" },
  { keys: ["filler"], label: "Filler" },
  { keys: ["country"], label: "Origin" },
  { keys: ["vitola"], label: "Vitola" },
  {
    // Standard cigar shorthand: "5.5\" × 50". Render either side independently
    // if only one is known.
    keys: ["length", "ring_gauge"],
    label: "Size",
    formatter: (_v, specs) => {
      const len = specs.length;
      const rg = specs.ring_gauge;
      const lenStr = typeof len === "number" ? `${len}"` : null;
      const rgStr = typeof rg === "number" ? `${rg}` : null;
      if (lenStr && rgStr) return `${lenStr} × ${rgStr}`;
      return lenStr ?? rgStr;
    },
  },
  { keys: ["strength"], label: "Strength" },
];

const BOURBON_FIELDS: FieldDef[] = [
  { keys: ["distillery"], label: "Distillery" },
  { keys: ["mash_bill"], label: "Mash bill" },
  { keys: ["proof"], label: "Proof", formatter: (v) => `${v}°` },
  {
    // Different seeders use different age keys: the original spreadsheet
    // emits `age_label` ("12 yr"), the Apify/CSV enrichment emits
    // `aging_period_years` or `age_years` (number). Surface whichever exists.
    keys: ["age_label", "age_years", "aging_period_years"],
    label: "Age",
    formatter: (v) => (typeof v === "number" ? `${v} yr` : String(v)),
  },
  { keys: ["dsp"], label: "DSP" },
];

function firstValue(specs: Specs, keys: string[]): unknown {
  for (const k of keys) {
    const v = specs[k];
    if (v !== null && v !== undefined && v !== "") return v;
  }
  return undefined;
}

function display(specs: Specs, field: FieldDef): string | null {
  const raw = firstValue(specs, field.keys);
  if (raw === undefined) return null;
  if (field.formatter) {
    const out = field.formatter(raw, specs);
    return out && out.trim() ? out : null;
  }
  return String(raw);
}

/**
 * CONSTRUCTION panel for the product detail page (UX-3). Promotes the
 * structural facts about how the bottle / cigar is made above the catch-all
 * facts strip. Two field sets — one for cigars, one for bourbons — drive a
 * tidy two-column key/value grid. Empty fields are skipped.
 */
export function ConstructionPanel({ productType, specs }: ConstructionPanelProps) {
  const fields = productType === "cigar" ? CIGAR_FIELDS : BOURBON_FIELDS;
  const rows = fields
    .map((f) => ({ field: f, value: display((specs ?? {}) as Specs, f) }))
    .filter((r): r is { field: FieldDef; value: string } => r.value !== null);

  // Dedupe by the field's first key — guards against accidental config doubles.
  const seen = new Set<string>();
  const uniqueRows = rows.filter((r) => {
    const k = r.field.keys[0];
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  if (uniqueRows.length === 0) {
    return (
      <Card>
        <p className="text-sm text-foreground-subtle">
          The Bartender hasn't catalogued how this one's made yet.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm">
        {uniqueRows.map(({ field, value }) => (
          <div key={field.keys[0]} className="contents">
            <dt className="text-foreground-subtle uppercase tracking-widest text-[10px] self-baseline pt-0.5">
              {field.label}
            </dt>
            <dd className="text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
