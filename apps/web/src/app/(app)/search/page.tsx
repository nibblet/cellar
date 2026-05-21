import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { PhotoFrame, PhotoPlaceholder, SearchInput } from "@/components/feed";
import { Divider, Voice } from "@/components/primitives";
import { signImagePaths } from "@/lib/feed/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { ProductType } from "@/lib/wheel";

type SearchParams = Promise<{ q?: string; type?: string }>;

type ResultRow = {
  id: string;
  name: string;
  brand: string | null;
  type: ProductType;
};

type TypeFilter = "all" | "cigar" | "bourbon";

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "cigar", label: "Cigars" },
  { value: "bourbon", label: "Bourbons" },
];

function parseTypeFilter(raw: string | undefined): TypeFilter {
  if (raw === "cigar" || raw === "bourbon") return raw;
  return "all";
}

// Sanitize the search term so it can't break the PostgREST .or() filter
// syntax. Allow letters, digits, spaces, and a handful of name-friendly
// punctuation; everything else becomes a space.
function sanitizeQuery(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9 .'\-&]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const { q: qRaw, type: typeRaw } = await searchParams;
  const rawQuery = (qRaw ?? "").slice(0, 80);
  const sanitized = sanitizeQuery(rawQuery);
  const typeFilter = parseTypeFilter(typeRaw);

  const supabase = await createSupabaseServerClient();

  let results: ResultRow[] = [];
  const signedByProduct = new Map<string, string>();

  if (sanitized.length >= 2) {
    let query = supabase
      .from("products")
      .select("id, name, brand, type")
      .eq("status", "confirmed")
      .or(`name.ilike.%${sanitized}%,brand.ilike.%${sanitized}%`)
      .order("name", { ascending: true })
      .limit(60);
    if (typeFilter !== "all") query = query.eq("type", typeFilter);
    const { data } = await query;
    results = (data as ResultRow[] | null) ?? [];

    if (results.length > 0) {
      const productIds = results.map((r) => r.id);
      const { data: heroes } = await supabase
        .from("product_images")
        .select("product_id, image_url, is_hero, created_at")
        .in("product_id", productIds)
        .order("is_hero", { ascending: false })
        .order("created_at", { ascending: false });

      const pathByProduct = new Map<string, string>();
      for (const h of heroes ?? []) {
        if (!pathByProduct.has(h.product_id)) pathByProduct.set(h.product_id, h.image_url);
      }
      const signedMap = await signImagePaths(supabase, Array.from(pathByProduct.values()));
      for (const [pid, path] of pathByProduct.entries()) {
        const signed = signedMap.get(path);
        if (signed) signedByProduct.set(pid, signed);
      }
    }
  }

  // Build URLs for the type filter chips, preserving the current query.
  const filterHref = (t: TypeFilter): string => {
    const next = new URLSearchParams();
    if (rawQuery.trim()) next.set("q", rawQuery.trim());
    if (t !== "all") next.set("type", t);
    const s = next.toString();
    return s ? `/search?${s}` : "/search";
  };

  const hasQuery = sanitized.length >= 2;
  const showingTooShort = rawQuery.trim().length > 0 && !hasQuery;

  return (
    <main className="mx-auto max-w-md px-5 py-6 pb-24 flex-1">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground mb-4"
      >
        <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Back
      </Link>

      <SearchInput initialQuery={rawQuery} />

      <div role="tablist" aria-label="Filter results" className="flex justify-center gap-5 mt-5">
        {TYPE_FILTERS.map((f) => {
          const active = f.value === typeFilter;
          return (
            <Link
              key={f.value}
              href={filterHref(f.value)}
              role="tab"
              aria-selected={active}
              className={cn(
                "text-xs tracking-widest uppercase pb-1 transition-colors",
                active
                  ? "text-foreground border-b-2 border-accent"
                  : "text-foreground-subtle border-b-2 border-transparent hover:text-foreground-muted",
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <Divider
        label={
          hasQuery
            ? `${results.length} ${results.length === 1 ? "result" : "results"}`
            : "Start typing"
        }
      />

      {!hasQuery ? (
        <Voice className="block text-center mt-2">
          {showingTooShort
            ? "A few more letters, sir."
            : "Search by name or brand — anything on the shelves."}
        </Voice>
      ) : results.length === 0 ? (
        <div className="text-center mt-2">
          <Voice className="block mb-3">"Nothing on the shelf by that name."</Voice>
          <p className="text-sm text-foreground-muted">
            <Link href="/capture" className="text-accent hover:underline">
              Snap a photo
            </Link>{" "}
            to add it to the archive.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {results.map((r) => (
            <li key={r.id}>
              <ResultRow row={r} signedHero={signedByProduct.get(r.id) ?? null} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function ResultRow({ row, signedHero }: { row: ResultRow; signedHero: string | null }) {
  return (
    <Link
      href={`/products/${row.id}`}
      className="flex items-center gap-3 rounded-[12px] border border-border bg-surface px-3 py-2.5 hover:bg-surface-2 transition-colors"
    >
      <div className="relative w-12 h-[60px] rounded-md overflow-hidden border border-border shrink-0">
        {signedHero ? (
          <PhotoFrame src={signedHero} alt={row.name} />
        ) : (
          <PhotoPlaceholder productType={row.type} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground truncate leading-snug">{row.name}</p>
        <p className="text-[11px] text-foreground-muted truncate mt-0.5">
          {row.brand ? `${row.brand} · ` : ""}
          <span className="uppercase tracking-widest text-foreground-subtle">{row.type}</span>
        </p>
      </div>
    </Link>
  );
}
