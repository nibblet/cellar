import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PairingFeedCard, TastingCard } from "@/components/feed";
import { AppShell } from "@/components/layout/app-shell";
import { LogFilterTabs } from "@/components/log/log-filter-tabs";
import { Button, Card, Divider, Voice } from "@/components/primitives";
import type { FeedItem } from "@/lib/feed/queries";
import { loadFeed, signImagePaths } from "@/lib/feed/queries";
import { type LogFilter, parseLogFilter } from "@/lib/log/parse-filter";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SearchParams = Promise<{ filter?: string }>;

function filterFeed(items: FeedItem[], filter: LogFilter): FeedItem[] {
  if (filter === "tastings") return items.filter((item) => item.kind === "tasting");
  if (filter === "pairings") return items.filter((item) => item.kind === "pairing");
  return items;
}

export default async function LogPage({ searchParams }: { searchParams: SearchParams }) {
  const { filter: filterRaw } = await searchParams;
  const filter = parseLogFilter(filterRaw);

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const allItems = await loadFeed(supabase, { userId: auth.user.id, limit: 100 });
  const items = filterFeed(allItems, filter);
  const signed = await signImagePaths(
    supabase,
    items.map((e) => e.hero_image_path),
  );

  const tastingCount = allItems.filter((e) => e.kind === "tasting").length;
  const pairingCount = allItems.filter((e) => e.kind === "pairing").length;

  return (
    <AppShell>
      <header className="mb-5">
        <h1 className="text-3xl">Log</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          {tastingCount} tasting{tastingCount === 1 ? "" : "s"}
          {pairingCount > 0 ? ` · ${pairingCount} pairing${pairingCount === 1 ? "" : "s"}` : ""}
        </p>
      </header>

      <Suspense fallback={null}>
        <LogFilterTabs active={filter} />
      </Suspense>

      <Divider label="Your captures" />

      {items.length === 0 ? (
        <Card className="text-center">
          <Voice className="block mb-4 text-sm">
            {filter === "pairings"
              ? '"No pairings captured yet. Pick a cigar and a pour from Tonight\'s pick."'
              : filter === "tastings"
                ? '"Nothing logged yet. Snap something next time you light up."'
                : '"Your log is empty. Capture your first tasting."'}
          </Voice>
          <Link href="/capture">
            <Button size="large" className="w-full">
              Capture something
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((entry) =>
            entry.kind === "pairing" ? (
              <PairingFeedCard
                key={entry.pairing_session_id}
                entry={entry}
                signedHero={
                  entry.hero_image_path ? (signed.get(entry.hero_image_path) ?? null) : null
                }
              />
            ) : (
              <TastingCard
                key={entry.tasting_id}
                entry={entry}
                signedHero={
                  entry.hero_image_path ? (signed.get(entry.hero_image_path) ?? null) : null
                }
              />
            ),
          )}
        </div>
      )}
    </AppShell>
  );
}
