import Link from "next/link";
import { Suspense } from "react";
import { NCCCLogo, Winston } from "@/components/brand";
import {
  CatalogCard,
  CatalogFilterControls,
  DailyPourCard,
  DailyPourSkeleton,
  FeedBodySkeleton,
  type FeedTab,
  FeedTabs,
  FindYourNextHero,
  FindYourNextSkeleton,
  MeetupCard,
  TastingCard,
} from "@/components/feed";
import { AppShell } from "@/components/layout/app-shell";
import { Button, Card, Divider, Voice } from "@/components/primitives";
import { loadCellarSnapshot } from "@/lib/cellar/load";
import { ZERO_ROW } from "@/lib/cellar/types";
import { loadDailyPourCandidates } from "@/lib/daily-pour/load";
import { selectDailyPour, todayKey } from "@/lib/daily-pour/select";
import {
  type CatalogFilters,
  type CatalogSortKey,
  groupCatalogByBrand,
  loadCatalogBrowse,
} from "@/lib/feed/catalog-queries";
import { loadFeed, signImagePaths } from "@/lib/feed/queries";
import { loadFindNextSuggestions } from "@/lib/find-next/load";
import { loadCachedPairingProse } from "@/lib/pairing/prose-cache";
import { loadMemberPreferences } from "@/lib/preferences/load";
import { productMatchesPreferences } from "@/lib/preferences/match";
import type {
  BourbonProofBand,
  BourbonStyle,
  CigarStrength,
  CigarWrapperBucket,
} from "@/lib/preferences/types";
import { CATALOG_TIER_CEILING, hasAnyPreferences } from "@/lib/preferences/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type MeetupEvent = {
  id: string;
  name: string;
  date: string;
  notes: string | null;
  tasting_count?: number;
};

type SearchParams = Promise<{
  tab?: string;
  // Cigar filters
  strength?: string;
  wrappers?: string;
  origin?: string;
  vitola?: string;
  ring?: string;
  // Bourbon filters
  styles?: string;
  proof?: string;
  age?: string;
  // Shared
  brand?: string;
  club?: string;
  enriched?: string;
  sort?: string;
}>;

function parseTab(raw: string | undefined): FeedTab {
  if (raw === "cigars" || raw === "bourbons") return raw;
  return "for-you";
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

  const ageBand =
    sp.age && VALID_AGE_BANDS.has(sp.age) ? (sp.age as "nas" | "4-8" | "8-12" | "12+") : undefined;

  const ringGauge =
    sp.ring && VALID_RING_BANDS.has(sp.ring) ? (sp.ring as "lt50" | "50-54" | "54+") : undefined;

  const sort = sp.sort && VALID_SORTS.has(sp.sort) ? (sp.sort as CatalogSortKey) : "recommended";

  return {
    filters: {
      strength,
      wrappers: wrappers?.length ? wrappers : undefined,
      origin: sp.origin || undefined,
      vitola: sp.vitola || undefined,
      ringGauge,
      brand: sp.brand || undefined,
      styles: styles?.length ? styles : undefined,
      proofBand,
      ageBand,
      clubOnly: sp.club === "1",
      enrichedOnly: sp.enriched === "1",
      sort,
    },
    sort,
  };
}

export default async function FeedPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const tab = parseTab(sp.tab);
  const { filters, sort } = parseFilters(sp);

  return (
    <AppShell>
      <header className="text-center mb-6 flex flex-col items-center">
        <NCCCLogo size={80} decorative />
      </header>

      <FeedTabs active={tab} />

      <Suspense fallback={<FeedBodySkeleton />}>
        <FeedBody tab={tab} filters={filters} sort={sort} />
      </Suspense>
    </AppShell>
  );
}

async function FeedBody({
  tab,
  filters,
  sort,
}: {
  tab: FeedTab;
  filters: CatalogFilters;
  sort: CatalogSortKey;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const viewerId = auth.user?.id ?? null;
  const preferences = viewerId ? await loadMemberPreferences(supabase, viewerId) : null;

  if (tab === "for-you") {
    return (
      <>
        {viewerId ? (
          <Suspense
            fallback={
              <>
                <DailyPourSkeleton />
                <FindYourNextSkeleton />
              </>
            }
          >
            <LoungeHeroSection supabase={supabase} viewerId={viewerId} preferences={preferences} />
          </Suspense>
        ) : null}
        <Suspense fallback={<FeedBodySkeleton />}>
          <FeedList supabase={supabase} viewerId={viewerId} preferences={preferences} />
        </Suspense>
      </>
    );
  }

  return (
    <CatalogBody
      supabase={supabase}
      viewerId={viewerId}
      productType={tab === "cigars" ? "cigar" : "bourbon"}
      preferences={preferences}
      filters={filters}
      sort={sort}
    />
  );
}

async function LoungeHeroSection({
  supabase,
  viewerId,
  preferences,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  viewerId: string;
  preferences: Awaited<ReturnType<typeof loadMemberPreferences>> | null;
}) {
  const candidates = await loadDailyPourCandidates(supabase, preferences, viewerId);
  const pour = selectDailyPour({ memberId: viewerId, date: todayKey() }, candidates);

  if (pour) {
    const cached = await loadCachedPairingProse(supabase, pour.cigar_id, pour.bourbon_id);
    if (cached?.notes) {
      pour.rationale = cached.notes;
    }
  }

  return (
    <div className="mb-4">
      {pour ? <DailyPourCard pour={pour} /> : null}
      <Suspense fallback={<FindYourNextSkeleton />}>
        <FindYourNextSection supabase={supabase} viewerId={viewerId} preferences={preferences} />
      </Suspense>
    </div>
  );
}

async function FindYourNextSection({
  supabase,
  viewerId,
  preferences,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  viewerId: string;
  preferences: Awaited<ReturnType<typeof loadMemberPreferences>> | null;
}) {
  const suggestions = await loadFindNextSuggestions(supabase, viewerId, preferences);
  return <FindYourNextHero suggestions={suggestions} />;
}

async function FeedList({
  supabase,
  viewerId,
  preferences,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  viewerId: string | null;
  preferences: Awaited<ReturnType<typeof loadMemberPreferences>> | null;
}) {
  const today = new Date().toISOString().slice(0, 10);

  const [entries, upcomingResult, lastResult] = await Promise.all([
    loadFeed(supabase, { limit: 50 }),
    supabase
      .from("events")
      .select("id, name, date, notes")
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(1),
    supabase
      .from("events")
      .select("id, name, date, notes, tastings(count)")
      .lt("date", today)
      .order("date", { ascending: false })
      .limit(1),
  ]);

  const signed = await signImagePaths(
    supabase,
    entries.map((e) => e.hero_image_path),
  );

  const matchesEnabled = preferences != null && hasAnyPreferences(preferences);
  const forYouByEntry = new Map<string, boolean>();
  if (matchesEnabled && preferences) {
    for (const e of entries) {
      if (e.user_id === viewerId) continue;
      const matches = productMatchesPreferences(
        { type: e.product_type, specs: e.product_specs },
        preferences,
      );
      if (matches) forYouByEntry.set(e.tasting_id, true);
    }
  }

  type LastEventRow = {
    id: string;
    name: string;
    date: string;
    notes: string | null;
    tastings: [{ count: number }] | null;
  };

  const upcoming = (upcomingResult.data as MeetupEvent[] | null)?.[0] ?? null;
  const lastRaw = (lastResult.data as LastEventRow[] | null)?.[0] ?? null;
  const last: MeetupEvent | null = lastRaw
    ? {
        id: lastRaw.id,
        name: lastRaw.name,
        date: lastRaw.date,
        notes: lastRaw.notes,
        tasting_count: lastRaw.tastings?.[0]?.count ?? 0,
      }
    : null;

  if (entries.length === 0) {
    return (
      <>
        {upcoming || last ? (
          <div className="mb-4">
            <MeetupCard upcoming={upcoming} last={last} />
          </div>
        ) : null}
        <Card className="flex flex-col items-center text-center">
          <Winston variant="bust" size={96} className="mb-4 rounded-full" />
          <Voice className="block mb-4">"Nothing logged yet, sir. The night is young."</Voice>
          <Link href="/capture" className="block w-full">
            <Button size="large" className="w-full">
              Open the humidor
            </Button>
          </Link>
        </Card>
      </>
    );
  }

  return (
    <>
      {upcoming || last ? (
        <div className="mb-4">
          <MeetupCard upcoming={upcoming} last={last} />
        </div>
      ) : null}
      <div className="flex flex-col gap-3">
        {entries.map((entry) => (
          <TastingCard
            key={entry.tasting_id}
            entry={entry}
            signedHero={entry.hero_image_path ? (signed.get(entry.hero_image_path) ?? null) : null}
            forYou={forYouByEntry.get(entry.tasting_id) ?? false}
          />
        ))}
      </div>
      <Divider label="That's all" />
      <p className="text-sm text-foreground-subtle text-center">
        Snap something to add to the archive.
      </p>
    </>
  );
}

async function CatalogBody({
  supabase,
  viewerId,
  productType,
  preferences,
  filters,
  sort,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  viewerId: string | null;
  productType: "cigar" | "bourbon";
  preferences: Awaited<ReturnType<typeof loadMemberPreferences>> | null;
  filters: CatalogFilters;
  sort: CatalogSortKey;
}) {
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
      {/* Filter + sort controls — client component, reads/writes URL params */}
      <CatalogFilterControls productType={productType} activeFilters={filters} activeSort={sort} />

      {entries.length === 0 ? (
        <Card className="text-center">
          <Voice className="block">
            {(preferences?.max_catalog_tier ?? 2) < CATALOG_TIER_CEILING
              ? '"Nothing on the shelf matching those terms, sir — try broadening the filter or the allocation slider in Settings."'
              : '"Nothing on the shelf matching those terms, sir. Try broadening the filter."'}
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

  // Bourbons cluster under their brand family (etched divider per brand);
  // cigars and any un-grouped tail render flat.
  if (grouped) {
    return (
      <div className="flex flex-col gap-3">
        {groupCatalogByBrand(entries).map((group) => (
          <section key={group.brand_family ?? "_ungrouped"} className="flex flex-col gap-3">
            {group.brand_family ? <Divider label={group.brand_family} /> : null}
            {group.entries.map(renderCard)}
          </section>
        ))}
      </div>
    );
  }

  return <div className="flex flex-col gap-3">{entries.map(renderCard)}</div>;
}
