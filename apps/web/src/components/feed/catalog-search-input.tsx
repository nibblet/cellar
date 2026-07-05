"use client";

import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type CatalogSearchInputProps = {
  initialQuery: string;
};

/**
 * Debounced catalog search tied to ?q= on /catalog. Sits inline below the
 * Products/Brands toggle and filters the current tab's product list.
 */
export function CatalogSearchInput({ initialQuery }: CatalogSearchInputProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const trimmed = value.trim();
    const next = new URLSearchParams(params.toString());
    if (trimmed) next.set("q", trimmed);
    else next.delete("q");
    const current = params.toString();
    if (next.toString() === current) return;

    const timeout = setTimeout(() => {
      router.replace(`/catalog?${next.toString()}`, { scroll: false });
    }, 220);

    return () => clearTimeout(timeout);
  }, [value, params, router]);

  return (
    <div className="relative mb-4">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-subtle"
        strokeWidth={1.75}
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search a cigar or bourbon"
        className="w-full pl-10 pr-10 py-3 bg-surface border border-border rounded-[12px] text-base placeholder:text-foreground-subtle focus:outline-none focus:border-accent transition-colors"
        aria-label="Search the catalog"
        autoComplete="off"
        spellCheck={false}
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            setValue("");
            inputRef.current?.focus();
          }}
          className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center min-w-11 min-h-11 text-foreground-subtle hover:text-foreground transition-colors"
          aria-label="Clear search"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
