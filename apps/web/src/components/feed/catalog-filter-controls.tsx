"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import type { CatalogFilters, CatalogSortKey } from "@/lib/feed/catalog-queries";
import {
  BOURBON_PROOF_BAND_LABEL,
  BOURBON_STYLE_LABEL,
  type BourbonProofBand,
  type BourbonStyle,
  CIGAR_STRENGTH_LABEL,
  CIGAR_WRAPPER_LABEL,
  type CigarStrength,
  type CigarWrapperBucket,
} from "@/lib/preferences/types";
import type { ProductType } from "@/lib/wheel";

type Props = {
  productType: ProductType;
  activeFilters: CatalogFilters;
  activeSort: CatalogSortKey;
};

const CIGAR_SORT_OPTIONS: { key: CatalogSortKey; label: string }[] = [
  { key: "recommended", label: "Most recommended" },
  { key: "az", label: "A–Z" },
  { key: "recent", label: "Recently added" },
  { key: "tasted", label: "Most tasted" },
  { key: "strength-asc", label: "Strength: light → full" },
];

const BOURBON_SORT_OPTIONS: { key: CatalogSortKey; label: string }[] = [
  { key: "recommended", label: "Most recommended" },
  { key: "az", label: "A–Z" },
  { key: "recent", label: "Recently added" },
  { key: "tasted", label: "Most tasted" },
  { key: "proof-asc", label: "Proof: low → high" },
  { key: "age-asc", label: "Age: young → old" },
];

const AGE_BAND_LABELS: Record<string, string> = {
  nas: "NAS",
  "4-8": "4–8 yr",
  "8-12": "8–12 yr",
  "12+": "12+ yr",
};

/**
 * Filter + sort control bar for the Cigars / Bourbons catalog tabs.
 * State lives in URL search params so it survives navigation and is shareable.
 */
export function CatalogFilterControls({ productType, activeFilters, activeSort }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, val] of Object.entries(updates)) {
        if (val == null || val === "") {
          params.delete(key);
        } else {
          params.set(key, val);
        }
      }
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const clearFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of [
      "strength",
      "wrappers",
      "origin",
      "styles",
      "proof",
      "age",
      "brand",
      "vitola",
      "ring",
      "club",
      "enriched",
    ]) {
      params.delete(key);
    }
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const filterCount = countActiveFilters(activeFilters);
  const sortOptions = productType === "cigar" ? CIGAR_SORT_OPTIONS : BOURBON_SORT_OPTIONS;
  const sortLabel = sortOptions.find((o) => o.key === activeSort)?.label ?? "Sort";

  return (
    <div className="mb-4">
      {/* Control row */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            setFilterOpen(!filterOpen);
            setSortOpen(false);
          }}
          className={`text-xs uppercase tracking-widest px-3 py-2.5 rounded-full border transition-colors ${
            filterCount > 0
              ? "border-accent text-accent bg-accent-tint"
              : "border-border text-foreground-subtle hover:text-foreground-muted"
          }`}
        >
          Filter{filterCount > 0 ? ` (${filterCount})` : ""}
        </button>

        <button
          type="button"
          onClick={() => {
            setSortOpen(!sortOpen);
            setFilterOpen(false);
          }}
          className="text-xs uppercase tracking-widest px-3 py-2.5 rounded-full border border-border text-foreground-subtle hover:text-foreground-muted transition-colors"
        >
          {sortLabel}
        </button>
      </div>

      {/* Active filter summary */}
      {filterCount > 0 ? (
        <div className="flex items-center gap-2 mt-2">
          <p className="text-xs text-foreground-subtle truncate flex-1">
            {buildFilterSummary(activeFilters, productType)}
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs text-foreground-subtle hover:text-foreground-muted shrink-0"
          >
            Clear
          </button>
        </div>
      ) : null}

      {/* Filter sheet */}
      {filterOpen ? (
        <FilterSheet
          productType={productType}
          activeFilters={activeFilters}
          onUpdate={updateParams}
          onClose={() => setFilterOpen(false)}
        />
      ) : null}

      {/* Sort sheet */}
      {sortOpen ? (
        <SortSheet
          options={sortOptions}
          active={activeSort}
          onSelect={(key) => {
            updateParams({ sort: key === "recommended" ? null : key });
            setSortOpen(false);
          }}
          onClose={() => setSortOpen(false)}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter sheet
// ---------------------------------------------------------------------------

function FilterSheet({
  productType,
  activeFilters,
  onUpdate,
  onClose,
}: {
  productType: ProductType;
  activeFilters: CatalogFilters;
  onUpdate: (u: Record<string, string | null>) => void;
  onClose: () => void;
}) {
  return (
    <div className="mt-3 rounded-2xl border border-border bg-surface p-4 flex flex-col gap-5">
      {/* Dev enriched toggle — top, subtle */}
      <section>
        <p className="text-[10px] uppercase tracking-widest text-foreground-subtle mb-2">Data</p>
        <label className="flex items-center gap-2 text-sm text-foreground-muted cursor-pointer">
          <input
            type="checkbox"
            checked={!!activeFilters.enrichedOnly}
            onChange={(e) => onUpdate({ enriched: e.target.checked ? "1" : null })}
            className="accent-accent"
          />
          Show enriched only (has photo + specs)
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground-muted cursor-pointer mt-2">
          <input
            type="checkbox"
            checked={!!activeFilters.clubOnly}
            onChange={(e) => onUpdate({ club: e.target.checked ? "1" : null })}
            className="accent-accent"
          />
          Recommended by the club
        </label>
      </section>

      <BrandFilter productType={productType} activeFilters={activeFilters} onUpdate={onUpdate} />

      {productType === "cigar" ? (
        <CigarFilters activeFilters={activeFilters} onUpdate={onUpdate} />
      ) : (
        <BourbonFilters activeFilters={activeFilters} onUpdate={onUpdate} />
      )}

      <button
        type="button"
        onClick={onClose}
        className="text-xs text-foreground-subtle hover:text-foreground-muted self-end mt-1"
      >
        Done
      </button>
    </div>
  );
}

function CigarFilters({
  activeFilters,
  onUpdate,
}: {
  activeFilters: CatalogFilters;
  onUpdate: (u: Record<string, string | null>) => void;
}) {
  const strengths: CigarStrength[] = ["mild", "mild-medium", "medium", "medium-full", "full"];
  const wrappers: CigarWrapperBucket[] = [
    "connecticut",
    "habano",
    "maduro",
    "san-andres",
    "corojo",
    "sumatra",
    "cameroon",
    "oscuro",
  ];

  return (
    <>
      <section>
        <p className="text-[10px] uppercase tracking-widest text-foreground-subtle mb-2">
          Strength
        </p>
        <div className="flex flex-wrap gap-1.5">
          {strengths.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onUpdate({ strength: activeFilters.strength === s ? null : s })}
              className={`text-xs px-2.5 py-2 rounded-full border transition-colors ${
                activeFilters.strength === s
                  ? "border-accent bg-accent-tint text-foreground"
                  : "border-border text-foreground-subtle hover:border-foreground-subtle"
              }`}
            >
              {CIGAR_STRENGTH_LABEL[s]}
            </button>
          ))}
        </div>
      </section>

      <section>
        <p className="text-[10px] uppercase tracking-widest text-foreground-subtle mb-2">Wrapper</p>
        <div className="flex flex-wrap gap-1.5">
          {wrappers.map((w) => {
            const active = activeFilters.wrappers?.includes(w);
            return (
              <button
                key={w}
                type="button"
                onClick={() => {
                  const current = activeFilters.wrappers ?? [];
                  const next = active ? current.filter((x) => x !== w) : [...current, w];
                  onUpdate({ wrappers: next.length ? next.join(",") : null });
                }}
                className={`text-xs px-2.5 py-2 rounded-full border transition-colors ${
                  active
                    ? "border-accent bg-accent-tint text-foreground"
                    : "border-border text-foreground-subtle hover:border-foreground-subtle"
                }`}
              >
                {CIGAR_WRAPPER_LABEL[w]}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <p className="text-[10px] uppercase tracking-widest text-foreground-subtle mb-2">Vitola</p>
        <input
          type="search"
          defaultValue={activeFilters.vitola ?? ""}
          placeholder="Robusto, Toro…"
          onChange={(e) => onUpdate({ vitola: e.target.value.trim() || null })}
          className="w-full rounded-[8px] border border-border bg-surface px-3 py-2.5 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </section>

      <section>
        <p className="text-[10px] uppercase tracking-widest text-foreground-subtle mb-2">
          Ring gauge
        </p>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["lt50", "< 50"],
              ["50-54", "50–54"],
              ["54+", "54+"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => onUpdate({ ring: activeFilters.ringGauge === key ? null : key })}
              className={`text-xs px-2.5 py-2 rounded-full border transition-colors ${
                activeFilters.ringGauge === key
                  ? "border-accent bg-accent-tint text-foreground"
                  : "border-border text-foreground-subtle hover:border-foreground-subtle"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function BrandFilter({
  productType,
  activeFilters,
  onUpdate,
}: {
  productType: ProductType;
  activeFilters: CatalogFilters;
  onUpdate: (u: Record<string, string | null>) => void;
}) {
  const catalogTab = productType === "cigar" ? "cigars" : "bourbons";
  const browseLabel = productType === "cigar" ? "Browse cigar brands" : "Browse bourbon brands";

  return (
    <section>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[10px] uppercase tracking-widest text-foreground-subtle">
          Brand / maker
        </p>
        <Link
          href={`/?tab=${catalogTab}&view=brands`}
          className="text-[10px] uppercase tracking-widest text-foreground-muted hover:text-foreground transition-colors shrink-0"
        >
          {browseLabel} →
        </Link>
      </div>
      <input
        type="search"
        defaultValue={activeFilters.brand ?? ""}
        placeholder="Perdomo, Jim Beam…"
        onChange={(e) => onUpdate({ brand: e.target.value.trim() || null })}
        className="w-full rounded-[8px] border border-border bg-surface px-3 py-2.5 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
    </section>
  );
}

function BourbonFilters({
  activeFilters,
  onUpdate,
}: {
  activeFilters: CatalogFilters;
  onUpdate: (u: Record<string, string | null>) => void;
}) {
  const styles: BourbonStyle[] = [
    "bourbon",
    "rye",
    "wheated",
    "high-rye",
    "bottled-in-bond",
    "single-barrel",
  ];
  const proofBands: BourbonProofBand[] = ["low", "mid", "high"];
  const ageBands = ["nas", "4-8", "8-12", "12+"] as const;

  return (
    <>
      <section>
        <p className="text-[10px] uppercase tracking-widest text-foreground-subtle mb-2">Style</p>
        <div className="flex flex-wrap gap-1.5">
          {styles.map((s) => {
            const active = activeFilters.styles?.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  const current = activeFilters.styles ?? [];
                  const next = active ? current.filter((x) => x !== s) : [...current, s];
                  onUpdate({ styles: next.length ? next.join(",") : null });
                }}
                className={`text-xs px-2.5 py-2 rounded-full border transition-colors ${
                  active
                    ? "border-accent bg-accent-tint text-foreground"
                    : "border-border text-foreground-subtle hover:border-foreground-subtle"
                }`}
              >
                {BOURBON_STYLE_LABEL[s]}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <p className="text-[10px] uppercase tracking-widest text-foreground-subtle mb-2">Proof</p>
        <div className="flex flex-wrap gap-1.5">
          {proofBands.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => onUpdate({ proof: activeFilters.proofBand === b ? null : b })}
              className={`text-xs px-2.5 py-2 rounded-full border transition-colors ${
                activeFilters.proofBand === b
                  ? "border-accent bg-accent-tint text-foreground"
                  : "border-border text-foreground-subtle hover:border-foreground-subtle"
              }`}
            >
              {BOURBON_PROOF_BAND_LABEL[b]}
            </button>
          ))}
        </div>
      </section>

      <section>
        <p className="text-[10px] uppercase tracking-widest text-foreground-subtle mb-2">Age</p>
        <div className="flex flex-wrap gap-1.5">
          {ageBands.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => onUpdate({ age: activeFilters.ageBand === b ? null : b })}
              className={`text-xs px-2.5 py-2 rounded-full border transition-colors ${
                activeFilters.ageBand === b
                  ? "border-accent bg-accent-tint text-foreground"
                  : "border-border text-foreground-subtle hover:border-foreground-subtle"
              }`}
            >
              {AGE_BAND_LABELS[b]}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sort sheet
// ---------------------------------------------------------------------------

function SortSheet({
  options,
  active,
  onSelect,
  onClose,
}: {
  options: { key: CatalogSortKey; label: string }[];
  active: CatalogSortKey;
  onSelect: (key: CatalogSortKey) => void;
  onClose: () => void;
}) {
  return (
    <div className="mt-3 rounded-2xl border border-border bg-surface p-4 flex flex-col gap-1">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onSelect(o.key)}
          className={`text-sm text-left px-2 py-2 rounded-lg transition-colors ${
            o.key === active
              ? "text-foreground font-medium bg-surface-2"
              : "text-foreground-muted hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
      <button
        type="button"
        onClick={onClose}
        className="text-xs text-foreground-subtle hover:text-foreground-muted self-end mt-2"
      >
        Cancel
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countActiveFilters(f: CatalogFilters): number {
  let n = 0;
  if (f.brand) n++;
  if (f.strength) n++;
  if (f.wrappers?.length) n++;
  if (f.origin) n++;
  if (f.vitola) n++;
  if (f.ringGauge) n++;
  if (f.styles?.length) n++;
  if (f.proofBand) n++;
  if (f.ageBand) n++;
  if (f.clubOnly) n++;
  if (f.enrichedOnly) n++;
  return n;
}

function buildFilterSummary(f: CatalogFilters, type: ProductType): string {
  const parts: string[] = [];
  if (f.brand) parts.push(f.brand);
  if (f.enrichedOnly) parts.push("enriched");
  if (f.clubOnly) parts.push("club recs");
  if (type === "cigar") {
    if (f.strength) parts.push(CIGAR_STRENGTH_LABEL[f.strength]);
    if (f.wrappers?.length) parts.push(f.wrappers.map((w) => CIGAR_WRAPPER_LABEL[w]).join(", "));
    if (f.origin) parts.push(f.origin);
    if (f.vitola) parts.push(f.vitola);
    if (f.ringGauge) parts.push(`RG ${f.ringGauge}`);
  } else {
    if (f.styles?.length) parts.push(f.styles.map((s) => BOURBON_STYLE_LABEL[s]).join(", "));
    if (f.proofBand) parts.push(BOURBON_PROOF_BAND_LABEL[f.proofBand]);
    if (f.ageBand) parts.push(AGE_BAND_LABELS[f.ageBand]);
  }
  return parts.join(" · ");
}
