import Link from "next/link";
import { NCCCLogo } from "@/components/brand";
import {
  CatalogCard,
  type FeedTab,
  FeedTabs,
  TastingCard,
  UpcomingMeetupCard,
} from "@/components/feed";
import { Button, Card, Divider, Voice } from "@/components/primitives";
import { loadCatalogBrowse } from "@/lib/feed/catalog-queries";
import { loadFeed, signImagePaths } from "@/lib/feed/queries";
import { loadMemberPreferences } from "@/lib/preferences/load";
import { productMatchesPreferences } from "@/lib/preferences/match";
import { hasAnyPreferences } from "@/lib/preferences/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type UpcomingEvent = {
  id: string;
  name: string;
  date: string;
  notes: string | null;
};

type SearchParams = Promise<{ tab?: string }>;

function parseTab(raw: string | undefined): FeedTab {
  if (raw === "cigars" || raw === "bourbons") return raw;
  return "for-you";
}

export default async function FeedPage({ searchParams }: { searchParams: SearchParams }) {
  const { tab: tabParam } = await searchParams;
  const tab = parseTab(tabParam);

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const viewerId = auth.user?.id ?? null;
  const preferences = viewerId ? await loadMemberPreferences(supabase, viewerId) : null;

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

      {tab === "for-you" ? (
        <ForYouBody supabase={supabase} viewerId={viewerId} preferences={preferences} />
      ) : (
        <CatalogBody
          supabase={supabase}
          productType={tab === "cigars" ? "cigar" : "bourbon"}
          preferences={preferences}
        />
      )}
    </main>
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
  const entries = await loadFeed(supabase, { limit: 50 });
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

  // Look forward 48h for any scheduled meetup; promote it above the feed.
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const horizon = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: upcomingRaw } = await supabase
    .from("events")
    .select("id, name, date, notes")
    .gte("date", today)
    .lte("date", horizon)
    .order("date", { ascending: true })
    .limit(1);
  const upcoming = (upcomingRaw as UpcomingEvent[] | null)?.[0] ?? null;

  if (entries.length === 0) {
    return (
      <>
        {upcoming ? (
          <div className="mb-4">
            <UpcomingMeetupCard event={upcoming} />
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
      {upcoming ? (
        <div className="mb-4">
          <UpcomingMeetupCard event={upcoming} />
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
  productType,
  preferences,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  productType: "cigar" | "bourbon";
  preferences: Awaited<ReturnType<typeof loadMemberPreferences>> | null;
}) {
  const entries = await loadCatalogBrowse(supabase, productType, preferences, 100);
  const signed = await signImagePaths(
    supabase,
    entries.map((e) => e.hero_image_path),
  );

  if (entries.length === 0) {
    return (
      <Card className="text-center">
        <Voice className="block">
          "The shelf is empty, sir. Check back as the catalog fills in."
        </Voice>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {entries.map((entry) => (
        <CatalogCard
          key={entry.product_id}
          entry={entry}
          signedHero={entry.hero_image_path ? (signed.get(entry.hero_image_path) ?? null) : null}
        />
      ))}
    </div>
  );
}
