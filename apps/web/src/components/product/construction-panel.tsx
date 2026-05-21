import { Card } from "@/components/primitives";
import type { ProductType } from "@/lib/wheel";

type Specs = Record<string, unknown>;

type ConstructionPanelProps = {
  productType: ProductType;
  specs: Specs | null | undefined;
};

type FieldDef = { key: string; label: string; formatter?: (v: unknown) => string };

const CIGAR_FIELDS: FieldDef[] = [
  { key: "wrapper", label: "Wrapper" },
  { key: "wrapper_color", label: "Wrapper color" },
  { key: "binder", label: "Binder" },
  { key: "filler", label: "Filler" },
  { key: "country", label: "Origin" },
  { key: "vitola", label: "Vitola" },
  { key: "strength", label: "Strength" },
];

const BOURBON_FIELDS: FieldDef[] = [
  { key: "distillery", label: "Distillery" },
  { key: "mash_bill", label: "Mash bill" },
  { key: "proof", label: "Proof", formatter: (v) => `${v}°` },
  { key: "age_label", label: "Age" },
  { key: "style_family", label: "Style" },
  { key: "dsp", label: "DSP" },
];

function display(spec: Specs, field: FieldDef): string | null {
  const raw = spec[field.key];
  if (raw === null || raw === undefined || raw === "") return null;
  if (field.formatter) return field.formatter(raw);
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

  if (rows.length === 0) {
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
        {rows.map(({ field, value }) => (
          <div key={field.key} className="contents">
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
