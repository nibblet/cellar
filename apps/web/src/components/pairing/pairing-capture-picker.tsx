"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, Divider } from "@/components/primitives";
import { filterPickerProducts, type PickerProduct } from "@/lib/pairing/picker-products";
import { cn } from "@/lib/utils";

type PairingCapturePickerProps = {
  cigars: PickerProduct[];
  bourbons: PickerProduct[];
  initialCigarId?: string;
};

type ProductPickerSectionProps = {
  label: string;
  products: PickerProduct[];
  query: string;
  onQueryChange: (query: string) => void;
  selected: PickerProduct | null;
  onSelect: (product: PickerProduct) => void;
  searchPlaceholder: string;
  searchLabel: string;
};

function ProductPickerSection({
  label,
  products,
  query,
  onQueryChange,
  selected,
  onSelect,
  searchPlaceholder,
  searchLabel,
}: ProductPickerSectionProps) {
  const filtered = useMemo(() => filterPickerProducts(products, query), [products, query]);

  return (
    <section className="flex flex-col gap-3">
      <Divider label={label} />

      <input
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={searchPlaceholder}
        className="w-full py-3 px-4 bg-surface border border-border rounded-[12px] text-base placeholder:text-foreground-subtle focus:outline-none focus:border-accent transition-colors"
        aria-label={searchLabel}
      />

      <ul
        className="flex flex-col gap-2 max-h-44 overflow-y-auto overscroll-contain rounded-[12px] border border-border/60 bg-surface-2 p-1"
        aria-label={label}
      >
        {filtered.length === 0 ? (
          <li className="px-3.5 py-6 text-center text-sm text-foreground-muted">No matches</li>
        ) : (
          filtered.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                onClick={() => onSelect(product)}
                className={cn(
                  "w-full text-left rounded-[10px] border px-3.5 py-3 transition-colors",
                  selected?.id === product.id
                    ? "border-accent bg-accent-tint"
                    : "border-transparent bg-surface hover:bg-surface-2",
                )}
              >
                <p className="text-sm text-foreground truncate">{product.name}</p>
                {product.brand ? (
                  <p className="text-xs text-foreground-muted truncate mt-0.5">{product.brand}</p>
                ) : null}
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

export function PairingCapturePicker({
  cigars,
  bourbons,
  initialCigarId,
}: PairingCapturePickerProps) {
  const initialCigar = initialCigarId ? cigars.find((c) => c.id === initialCigarId) : null;
  const [cigarQuery, setCigarQuery] = useState("");
  const [bourbonQuery, setBourbonQuery] = useState("");
  const [cigar, setCigar] = useState<PickerProduct | null>(initialCigar ?? null);
  const [bourbon, setBourbon] = useState<PickerProduct | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <ProductPickerSection
        label="Pick a cigar"
        products={cigars}
        query={cigarQuery}
        onQueryChange={setCigarQuery}
        selected={cigar}
        onSelect={setCigar}
        searchPlaceholder="Search cigars…"
        searchLabel="Search cigars"
      />

      <ProductPickerSection
        label="Pick a bourbon"
        products={bourbons}
        query={bourbonQuery}
        onQueryChange={setBourbonQuery}
        selected={bourbon}
        onSelect={setBourbon}
        searchPlaceholder="Search bourbons…"
        searchLabel="Search bourbons"
      />

      {cigar && bourbon ? (
        <Link href={`/pairings/${cigar.id}/${bourbon.id}/taste`} className="block">
          <Button size="large" className="w-full">
            Continue to capture
          </Button>
        </Link>
      ) : null}
    </div>
  );
}
