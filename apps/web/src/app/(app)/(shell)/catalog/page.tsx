import Link from "next/link";
import { Suspense } from "react";
import {
  BrandFamilyDivider,
  CatalogCard,
  CatalogFilterControls,
  CatalogSearchInput,
  type CatalogView,
  CatalogViewToggle,
  FeedBodySkeleton,
} from "@/components/feed";
import { AppShell } from "@/components/layout/app-shell";
import { MakerSummaryList } from "@/components/makers/maker-summary-list";
import { Card, Voice } from "@/components/primitives";
import type { AvailabilityRarity } from "@/lib/catalog/normalize-specs";
import { sanitizeCatalogQuery } from "@/lib/catalog/search";
import { loadCellarSnapshot } from "@/lib/cellar/load";
import { ZERO_ROW } from "@/lib/cellar/types";
import {
  type CatalogFilters,
  type CatalogSortKey,
  groupCatalogByBrand,
  loadCatalogBrowse,
} from "@/lib/feed/catalog-queries";
import { signImagePaths } from "@/lib/feed/queries";
import { loadMakerSummaries } from "@/lib/makers/browse";
import { loadMemberPreferences } from "@/lib/preferences/load";
import type {
  BourbonProofBand,
  BourbonStyle,
  CigarStrength,
  CigarWrapperBucket,
} from "@/lib/preferences/types";
import { CATALOG_TIER_CEILING, DEFAULT_MAX_CATALOG_TIER } from "@/lib/preferences/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type CatalogTab = "cigars" | "bourbons";

type SearchParams = Promise<{
  type?: string;
  view?: string;
  q?: string;
  strength?: string;
  wrappers?: string;
  origin?: string;
  vitola?: string;
  ring?: string;
  styles?: string;
  proof?: string;
  availability?: string;
  age?: string;
  brand?: string;
  enriched?: string;
  sort?: string;
}>;

function parseTab(raw: string | undefined): CatalogTab {
  return raw === "bourbons" ? "bourbons" : "cigars";
}

function parseCatalogView(raw: string | undefined): CatalogView {
  return raw === "makers" || raw === "brands" ? "makers" : "products";
}

const VALID_STRENGTHS = new Set(["mild", "mild-medium", "medium", "medium-full", "full"]);
const VALID_WRAPPERS = new Set([
  "connecticut",
  "habano",
  "maduro",
  "san-andres",
  "corojo",
  "sumatra",
  "cameroon",
  "oscuro",
]);
const VALID_STYLES = new Set([
  "bourbon",
  "rye",
  "wheated",
  "high-rye",
  "bottled-in-bond",
  "single-barrel",
]);
const VALID_PROOF_BANDS = new Set(["low", "mid", "high"]);
const VALID_AVAILABILITY = new Set([
  "everyday",
  "seasonal",
  "allocated",
  "lottery",
  "secondary-only",
]);
const VALID_AGE_BANDS = new Set(["nas", "4-8", "8-12", "12+"]);
const VALID_RING_BANDS = new Set(["lt50", "50-54", "54+"]);
const VALID_SORTS = new Set([
  "recommended",
  "az",
  "recent",
  "tasted",
  "strength-asc",
  "proof-asc",
  "age-asc",
]);

function parseFilters(sp: Awaited<SearchParams>): {
  filters: CatalogFilters;
  sort: CatalogSortKey;
} {
  const strength =
    sp.strength && VALID_STRENGTHS.has(sp.strength) ? (sp.strength as CigarStrength) : undefined;

  const wrappers = sp.wrappers
    ? (sp.wrappers.split(",").filter((w) => VALID_WRAPPERS.has(w)) as CigarWrapperBucket[])
    : undefined;

  const styles = sp.styles
    ? (sp.styles.split(",").filter((s) => VALID_STYLES.has(s)) as BourbonStyle[])
    : undefined;

  const proofBand =
    sp.proof && VALID_PROOF_BANDS.has(sp.proof) ? (sp.proof as BourbonProofBand) : undefined;

  const availability =
    sp.availability && VALID_AVAILABILITY.has(sp.availability)
      ? (sp.availability as AvailabilityRarity)
      : undefined;

  const ageBand =
    sp.age && VALID_AGE_BANDS.has(sp.age) ? (sp.age as "nas" | "4-8" | "8-12" | "12+") : undefined;

  const ringGauge =
    sp.ring && VALID_RING_BANDS.has(sp.ring) ? (sp.ring as "lt50" | "50-54" | "54+") : undefined;

  const sort = sp.sort && VALID_SORTS.has(sp.sort) ? (sp.sort as CatalogSortKey) : "recommended";
  const sanitizedQuery = sanitizeCatalogQuery(sp.q ?? "");

  return {
    filters: {
      strength,
      wrappers: wrappers?.length ? wrappers : undefined,
      origin: sp.origin || undefined,
      vitola: sp.vitola || undefined,
      ringGauge,
      brand: sp.brand || undefined,
      query: sanitizedQuery.length >= 2 ? sanitizedQuery : undefined,
      styles: styles?.length ? styles : undefined,
      proofBand,
      availability,
      ageBand,
      clubOnly: false,
      enrichedOnly: sp.enriched === "1",
      sort,
    },
    sort,
  };
}

export default async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const tab = parseTab(sp.type);
  const catalogView = parseCatalogView(sp.view);
  const { filters, sort } = parseFilters(sp);
  const searchQuery = sp.q?.trim() ?? "";

  return (
    <AppShell>
      <header className="mb-5">
        <h1 className="text-3xl">The catalog</h1>
      </header>

      <CatalogTabs active={tab} />

      <Suspense fallback={<FeedBodySkeleton />}>
        <CatalogBody
          catalogTab={tab}
          catalogView={catalogView}
          productType={tab === "cigars" ? "cigar" : "bourbon"}
          filters={filters}
          sort={sort}
          searchQuery={searchQuery}
        />
      </Suspense>
    </AppShell>
  );
}

function CatalogTabs({ active }: { active: CatalogTab }) {
  const tabs: { value: CatalogTab; label: string }[] = [
    { value: "cigars", label: "Cigars" },
    { value: "bourbons", label: "Bourbons" },
  ];
  return (
    <div className="mb-5 flex justify-center gap-6" role="tablist" aria-label="The catalog">
      {tabs.map((t) => (
        <Link
          key={t.value}
          href={`/catalog?type=${t.value}`}
          role="tab"
          aria-selected={t.value === active}
          className={cn(
            "text-xs tracking-widest uppercase pb-1 transition-colors",
            t.value === active
              ? "text-foreground border-b-2 border-accent"
              : "text-foreground-subtle border-b-2 border-transparent hover:text-foreground-muted",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

async function CatalogBody({
  catalogTab,
  catalogView,
  productType,
  filters,
  sort,
  searchQuery,
}: {
  catalogTab: CatalogTab;
  catalogView: CatalogView;
  productType: "cigar" | "bourbon";
  filters: CatalogFilters;
  sort: CatalogSortKey;
  searchQuery: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const viewerId = auth.user?.id ?? null;
  const preferences = viewerId ? await loadMemberPreferences(supabase, viewerId) : null;

  if (catalogView === "makers") {
    const maxCatalogTier = preferences?.max_catalog_tier ?? DEFAULT_MAX_CATALOG_TIER;
    const summaries = await loadMakerSummaries(supabase, productType, maxCatalogTier);
    const emptyMessage =
      productType === "cigar"
        ? '"No cigar brands in the catalog yet."'
        : '"No bourbon brands in the catalog yet."';

    return (
      <>
        <CatalogViewToggle tab={catalogTab} activeView="makers" />
        <MakerSummaryList summaries={summaries} emptyMessage={emptyMessage} />
      </>
    );
  }

  const [entries, cellarSnapshot] = await Promise.all([
    loadCatalogBrowse(supabase, productType, preferences, 500, filters),
    viewerId ? loadCellarSnapshot(supabase, viewerId) : null,
  ]);
  const signed = await signImagePaths(
    supabase,
    entries.map((e) => e.hero_image_path),
  );

  return (
    <>
      <CatalogViewToggle tab={catalogTab} activeView="products" />
      <Suspense fallback={null}>
        <CatalogSearchInput initialQuery={searchQuery} />
      </Suspense>
      <CatalogFilterControls productType={productType} activeFilters={filters} activeSort={sort} />

      {entries.length === 0 ? (
        <Card className="text-center">
          <Voice className="block">
            {(preferences?.max_catalog_tier ?? 2) < CATALOG_TIER_CEILING
              ? '"Nothing in the catalog under those terms. Widen the filter, or stretch the allocation in Settings."'
              : '"Nothing in the catalog under those terms. Widen the filter."'}
          </Voice>
        </Card>
      ) : (
        <CatalogList
          entries={entries}
          grouped={productType === "bourbon"}
          signed={signed}
          cellarSnapshot={cellarSnapshot}
          showCellar={Boolean(viewerId)}
        />
      )}
    </>
  );
}

function CatalogList({
  entries,
  grouped,
  signed,
  cellarSnapshot,
  showCellar,
}: {
  entries: Awaited<ReturnType<typeof loadCatalogBrowse>>;
  grouped: boolean;
  signed: Map<string, string>;
  cellarSnapshot: Awaited<ReturnType<typeof loadCellarSnapshot>> | null;
  showCellar: boolean;
}) {
  const renderCard = (entry: (typeof entries)[number]) => {
    const cellarState = cellarSnapshot
      ? {
          have: cellarSnapshot.have.has(entry.product_id),
          want: cellarSnapshot.want.has(entry.product_id),
          tried: cellarSnapshot.tried.has(entry.product_id),
          loved: cellarSnapshot.loved.has(entry.product_id),
        }
      : ZERO_ROW;
    return (
      <CatalogCard
        key={entry.product_id}
        entry={entry}
        signedHero={entry.hero_image_path ? (signed.get(entry.hero_image_path) ?? null) : null}
        cellarState={showCellar ? cellarState : null}
      />
    );
  };

  if (grouped) {
    return (
      <div className="flex flex-col gap-3">
        {groupCatalogByBrand(entries).map((group) => (
          <section key={group.brand_family ?? "_ungrouped"} className="flex flex-col gap-3">
            {group.brand_family ? <BrandFamilyDivider group={group} /> : null}
            {group.entries.map(renderCard)}
          </section>
        ))}
      </div>
    );
  }

  return <div className="flex flex-col gap-3">{entries.map(renderCard)}</div>;
}
