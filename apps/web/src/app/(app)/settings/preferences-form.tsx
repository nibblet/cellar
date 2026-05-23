"use client";

import { useActionState, useState } from "react";
import { Button, Chip, Voice } from "@/components/primitives";
import {
  BOURBON_PROOF_BAND_LABEL,
  BOURBON_PROOF_BANDS,
  BOURBON_STYLE_LABEL,
  BOURBON_STYLES,
  CATALOG_TIER_CEILING,
  CATALOG_TIER_FLOOR,
  CIGAR_STRENGTH_LABEL,
  CIGAR_STRENGTHS,
  CIGAR_WRAPPER_BUCKETS,
  CIGAR_WRAPPER_LABEL,
  MAX_CATALOG_TIER_LABEL,
  type MemberPreferences,
} from "@/lib/preferences/types";
import { type PreferencesFormState, savePreferences } from "./actions";

const initialState: PreferencesFormState = { ok: false, message: null };

export function PreferencesForm({ initial }: { initial: MemberPreferences }) {
  const [state, formAction, pending] = useActionState(savePreferences, initialState);

  const [cigarStrengths, setCigarStrengths] = useState<string[]>(initial.cigar_strengths);
  const [cigarWrappers, setCigarWrappers] = useState<string[]>(initial.cigar_wrappers);
  const [bourbonStyles, setBourbonStyles] = useState<string[]>(initial.bourbon_styles);
  const [proofBands, setProofBands] = useState<string[]>(initial.bourbon_proof_bands);
  const [maxCatalogTier, setMaxCatalogTier] = useState(initial.max_catalog_tier);

  const tierSteps = [2, 3, 4, 5] as const;

  return (
    <form action={formAction} className="space-y-5">
      <Voice className="block">
        "Tell me what you reach for, sir. I'll lean your way — never the other."
      </Voice>

      <ChipGroup
        legend="Cigar strength"
        name="cigar_strengths"
        options={CIGAR_STRENGTHS}
        labels={CIGAR_STRENGTH_LABEL}
        selected={cigarStrengths}
        onChange={setCigarStrengths}
      />

      <ChipGroup
        legend="Cigar wrapper"
        name="cigar_wrappers"
        options={CIGAR_WRAPPER_BUCKETS}
        labels={CIGAR_WRAPPER_LABEL}
        selected={cigarWrappers}
        onChange={setCigarWrappers}
      />

      <ChipGroup
        legend="Bourbon style"
        name="bourbon_styles"
        options={BOURBON_STYLES}
        labels={BOURBON_STYLE_LABEL}
        selected={bourbonStyles}
        onChange={setBourbonStyles}
      />

      <ChipGroup
        legend="Bourbon proof"
        name="bourbon_proof_bands"
        options={BOURBON_PROOF_BANDS}
        labels={BOURBON_PROOF_BAND_LABEL}
        selected={proofBands}
        onChange={setProofBands}
      />

      <div className="pt-1 border-t border-border">
        <p className="text-[11px] tracking-widest uppercase text-foreground-subtle mb-2">
          Catalog shelf
        </p>
        <p className="text-xs text-foreground-subtle leading-relaxed mb-4">
          How far up the allocation ladder the Cigars and Bourbons lists reach, sir.
        </p>
        <label className="block">
          <span className="text-sm text-foreground block mb-3">
            {MAX_CATALOG_TIER_LABEL[maxCatalogTier] ?? MAX_CATALOG_TIER_LABEL[2]}
          </span>
          <input
            type="range"
            name="max_catalog_tier"
            min={CATALOG_TIER_FLOOR}
            max={CATALOG_TIER_CEILING}
            step={1}
            value={maxCatalogTier}
            onChange={(e) => setMaxCatalogTier(Number(e.target.value))}
            className="w-full accent-accent"
          />
          <div className="mt-2 flex justify-between text-[10px] uppercase tracking-wider text-foreground-subtle">
            {tierSteps.map((tier) => (
              <span
                key={tier}
                className={tier === maxCatalogTier ? "text-foreground-muted" : undefined}
              >
                T{tier}
              </span>
            ))}
          </div>
        </label>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? "Saving..." : "Save preferences"}
        </Button>
        {state.message ? (
          <span
            className={state.ok ? "text-sm text-moss-600" : "text-sm text-foreground-subtle"}
            aria-live="polite"
          >
            {state.message}
          </span>
        ) : null}
      </div>

      <p className="text-xs text-foreground-subtle">
        Leave everything unselected and Winston stays neutral.
      </p>
    </form>
  );
}

type ChipGroupProps<T extends string> = {
  legend: string;
  name: string;
  options: readonly T[];
  labels: Record<T, string>;
  selected: string[];
  onChange: (next: string[]) => void;
};

function ChipGroup<T extends string>({
  legend,
  name,
  options,
  labels,
  selected,
  onChange,
}: ChipGroupProps<T>) {
  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: <fieldset is over-broad for visual chip groups; this is a labelled toggle row, not a form-control fieldset>
    <div role="group" aria-label={legend}>
      <p className="text-[11px] tracking-widest uppercase text-foreground-subtle mb-2">{legend}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <Chip
            key={opt}
            type="button"
            selected={selected.includes(opt)}
            aria-pressed={selected.includes(opt)}
            onClick={() => toggle(opt)}
          >
            {labels[opt]}
          </Chip>
        ))}
      </div>
      {selected.map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}
    </div>
  );
}
