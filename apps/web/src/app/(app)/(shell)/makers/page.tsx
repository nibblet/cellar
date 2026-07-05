import Link from "next/link";
import { redirect } from "next/navigation";
import { MakerSummaryList } from "@/components/makers/maker-summary-list";
import { AppShell } from "@/components/layout/app-shell";
import { Divider, Voice } from "@/components/primitives";
import { loadMakerSummaries } from "@/lib/makers/browse";
import { loadMemberPreferences } from "@/lib/preferences/load";
import { DEFAULT_MAX_CATALOG_TIER } from "@/lib/preferences/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProductType } from "@/lib/wheel";

type SearchParams = Promise<{ type?: string }>;

function parseTypeFilter(raw: string | undefined): ProductType | undefined {
  if (raw === "cigar" || raw === "bourbon") return raw;
  return undefined;
}

export default async function MakersBrowsePage({ searchParams }: { searchParams: SearchParams }) {
  const { type: typeRaw } = await searchParams;
  const typeFilter = parseTypeFilter(typeRaw);

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const preferences = await loadMemberPreferences(supabase, auth.user.id);
  const maxCatalogTier = preferences?.max_catalog_tier ?? DEFAULT_MAX_CATALOG_TIER;
  const all = await loadMakerSummaries(supabase, undefined, maxCatalogTier);
  const cigars = typeFilter === "bourbon" ? [] : all.filter((m) => m.type === "cigar");
  const bourbons = typeFilter === "cigar" ? [] : all.filter((m) => m.type === "bourbon");

  const showCigars = typeFilter !== "bourbon";
  const showBourbons = typeFilter !== "cigar";

  return (
    <AppShell>
      <header className="mb-6">
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">Catalog</p>
        <h1 className="text-3xl mt-1">
          {typeFilter === "cigar"
            ? "Cigar brands"
            : typeFilter === "bourbon"
              ? "Bourbon brands"
              : "Catalog brands"}
        </h1>
        {typeFilter ? (
          <Link
            href="/makers"
            className="text-sm text-foreground-muted hover:text-foreground mt-2 inline-block transition-colors"
          >
            Show all brands →
          </Link>
        ) : null}
      </header>

      {all.length === 0 ? (
        <Voice className="block text-sm">
          "No brands in the club catalog yet — capture something and they will appear."
        </Voice>
      ) : (
        <>
          {showCigars ? (
            <>
              <Divider label="Cigar brands" />
              <div className="mt-4 mb-6">
                <MakerSummaryList
                  summaries={cigars}
                  emptyMessage='"No cigar brands in the catalog yet."'
                />
              </div>
            </>
          ) : null}

          {showBourbons ? (
            <>
              <Divider label="Bourbon brands" />
              <div className="mt-4">
                <MakerSummaryList
                  summaries={bourbons}
                  emptyMessage='"No bourbon brands in the catalog yet."'
                />
              </div>
            </>
          ) : null}
        </>
      )}

      <div className="mt-8 flex flex-col gap-2 text-sm">
        <Link
          href="/catalog?type=cigars&view=makers"
          className="text-foreground-muted hover:text-foreground transition-colors"
        >
          Cigar brands in catalog tab →
        </Link>
        <Link
          href="/catalog?type=bourbons&view=makers"
          className="text-foreground-muted hover:text-foreground transition-colors"
        >
          Bourbon brands in catalog tab →
        </Link>
      </div>
    </AppShell>
  );
}
