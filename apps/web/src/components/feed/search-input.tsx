"use client";

import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type SearchInputProps = {
  initialQuery: string;
};

/**
 * Debounced, URL-driven search input. Owns its own value locally so typing
 * feels instant, then syncs the URL (?q=...) after a short pause so the
 * server can re-render results. Result rendering lives on the page; this
 * component only owns the text.
 */
export function SearchInput({ initialQuery }: SearchInputProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const trimmed = value.trim();
    const next = new URLSearchParams(params.toString());
    if (trimmed) next.set("q", trimmed);
    else next.delete("q");
    const current = params.toString();
    if (next.toString() === current) return;

    const t = setTimeout(() => {
      router.replace(`/search?${next.toString()}`, { scroll: false });
    }, 220);
    return () => clearTimeout(t);
  }, [value, params, router]);

  return (
    <div className="relative">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-subtle"
        strokeWidth={1.75}
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
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
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-foreground-subtle hover:text-foreground transition-colors"
          aria-label="Clear search"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
