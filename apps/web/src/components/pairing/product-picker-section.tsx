"use client";

import { useEffect, useState } from "react";
import { searchPickerProducts } from "@/app/(app)/(shell)/pairings/capture/search-picker";
import { Divider } from "@/components/primitives";
import { isCatalogSearchReady } from "@/lib/catalog/search";
import { cn } from "@/lib/utils";

type PickerProduct = { id: string; name: string; brand: string | null };

type ProductPickerSectionProps = {
  label: string;
  productType: "cigar" | "bourbon";
  onSelect: (product: PickerProduct) => void;
};

export function ProductPickerSection({ label, productType, onSelect }: ProductPickerSectionProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickerProduct[]>([]);
  const [searching, setSearching] = useState(false);

  const searchReady = isCatalogSearchReady(query);
  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!searchReady) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    let cancelled = false;
    const t = setTimeout(() => {
      searchPickerProducts(trimmedQuery, productType).then((rows) => {
        if (!cancelled) {
          setResults(rows);
          setSearching(false);
        }
      });
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [trimmedQuery, productType, searchReady]);

  const emptyMessage = !trimmedQuery
    ? "Search by name or brand"
    : !searchReady
      ? "A few more letters"
      : searching
        ? "Searching…"
        : "No matches";

  return (
    <section className="flex flex-col gap-3">
      <Divider label={label} />

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={productType === "cigar" ? "Search cigars…" : "Search bourbons…"}
        className="w-full py-3 px-4 bg-surface border border-border rounded-[12px] text-base placeholder:text-foreground-subtle focus:outline-none focus:border-accent transition-colors"
        autoComplete="off"
        spellCheck={false}
      />

      <ul
        className="flex flex-col gap-2 max-h-44 overflow-y-auto overscroll-contain rounded-[12px] border border-border/60 bg-surface-2 p-1"
        aria-busy={searching}
      >
        {results.length === 0 ? (
          <li className="px-3.5 py-6 text-center text-sm text-foreground-muted">{emptyMessage}</li>
        ) : (
          results.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                onClick={() => onSelect(product)}
                className={cn(
                  "w-full text-left rounded-[10px] border px-3.5 py-3 transition-colors",
                  "border-transparent bg-surface hover:bg-surface-2",
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
