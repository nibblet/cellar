import Link from "next/link";
import { Suspense } from "react";
import { NCCCLogo } from "@/components/brand";
import {
  CatalogCard,
  CatalogFilterControls,
  DailyPourCard,
  FeedBodySkeleton,
  type FeedTab,
  FeedTabs,
  MeetupCard,
  TastingCard,
} from "@/components/feed";
import { Button, Card, Divider, Voice } from "@/components/primitives";
import { loadDailyPourCandidates } from "@/lib/daily-pour/load";
import { selectDailyPour, todayKey } from "@/lib/daily-pour/select";
import { loadCellarSnapshot } from "@/lib/cellar/load";
import { ZERO_ROW } from "@/lib/cellar/types";
import {
  type CatalogFilters,
  type CatalogSortKey,
  loadCatalogBrowse,
} from "@/lib/feed/catalog-queries";
import { loadFeed, signImagePaths } from "@/lib/feed/queries";
import { loadCachedPairingProse } from "@/lib/pairing/prose-cache";
import { loadMemberPreferences } from "@/lib/preferences/load";
import { productMatchesPreferences } from "@/lib/preferences/match";
import type {
  BourbonProofBand,
  BourbonStyle,
  CigarStrength,
  CigarWrapperBucket,
} from "@/lib/preferences/types";
import { hasAnyPreferences } from "@/lib/preferences/types";
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
  // Bourbon filters
  styles?: string;
  proof?: string;
  age?: string;
  // Shared
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

  const sort = sp.sort && VALID_SORTS.has(sp.sort) ? (sp.sort as CatalogSortKey) : "recommended";

  return {
    filters: {
      strength,
      wrappers: wrappers?.length ? wrappers : undefined,
      origin: sp.origin || undefined,
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
    <main className="mx-auto max-w-md px-5 py-6 pb-24 flex-1">
      <header className="text-center mb-6 flex flex-col items-center">
        <NCCCLogo size={56} className="mb-2" decorative />
        <h1 className="text-3xl">NCCC</h1>
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">
          {tab === "for-you"
            ? "Recent tastings"
            : tab === "cigars"
              ? "The cigar shelf"
              : "The bourbon shelf"}
        </p>
      </header>

      <FeedTabs active={tab} />

      <Suspense fallback={<FeedBodySkeleton />}>
        <FeedBody tab={tab} filters={filters} sort={sort} />
      </Suspense>
    </main>
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
    return <ForYouBody supabase={supabase} viewerId={viewerId} preferences={preferences} />;
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

async function ForYouBody({
  supabase,
  viewerId,
  preferences,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  viewerId: string | null;
  preferences: Awaited<ReturnType<typeof loadMemberPreferences>> | null;
}) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const [entries, dailyPourCandidates, upcomingResult, lastResult] = await Promise.all([
    loadFeed(supabase, { limit: 50 }),
    viewerId ? loadDailyPourCandidates(supabase, preferences, viewerId) : Promise.resolve([]),
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

  const dailyPour = viewerId
    ? selectDailyPour({ memberId: viewerId, date: todayKey() }, dailyPourCandidates)
    : null;

  if (dailyPour) {
    const cached = await loadCachedPairingProse(
      supabase,
      dailyPour.cigar_id,
      dailyPour.bourbon_id,
    );
    dailyPour.rationale = cached?.notes ?? null;
  }

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
        {dailyPour ? <DailyPourCard pour={dailyPour} /> : null}
        {upcoming || last ? (
          <div className="mb-4">
            <MeetupCard upcoming={upcoming} last={last} />
          </div>
        ) : null}
        <Card className="flex flex-col items-center text-center">
          <NCCCLogo size={96} className="mb-4" decorative />
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
      {dailyPour ? <DailyPourCard pour={dailyPour} /> : null}
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
    loadCatalogBrowse(supabase, productType, preferences, 100, filters),
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
            "Nothing on the shelf matching those terms, sir. Try broadening the filter."
          </Voice>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => {
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
                signedHero={
                  entry.hero_image_path ? (signed.get(entry.hero_image_path) ?? null) : null
                }
                cellarState={viewerId ? cellarState : null}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
