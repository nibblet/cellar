import Link from "next/link";
import { redirect } from "next/navigation";
import { PairingFeedCard, TastingCard } from "@/components/feed";
import { AppShell } from "@/components/layout/app-shell";
import { Divider, Voice } from "@/components/primitives";
import { TasteProfileHero } from "@/components/you/taste-profile-hero";
import { loadCachedInsight } from "@/lib/cellar/insight";
import { loadCellarSnapshot } from "@/lib/cellar/load";
import { loadFeed, signImagePaths } from "@/lib/feed/queries";
import { loadProductTypes, splitIdsByProductType } from "@/lib/products/split-by-type";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildLastActivityLine } from "@/lib/you/last-activity";

export default async function YouHubPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const me = auth.user.id;

  const [profileResult, snapshot, tastingsCountResult, cachedInsight, recentFeed] =
    await Promise.all([
      supabase.from("users").select("id, name_first, name_last_initial").eq("id", me).maybeSingle(),
      loadCellarSnapshot(supabase, me),
      supabase.from("tastings").select("id", { count: "exact", head: true }).eq("user_id", me),
      loadCachedInsight(supabase, me),
      loadFeed(supabase, { userId: me, limit: 1 }),
    ]);

  if (!profileResult.data) redirect("/login");
  const profile = profileResult.data;

  const haveTypeRows = await loadProductTypes(supabase, snapshot.have);
  const { bourbons, cigars } = splitIdsByProductType(haveTypeRows);
  const tastingsCount = tastingsCountResult.count ?? 0;
  const lastEntry = recentFeed[0] ?? null;

  const lastTastingProduct =
    lastEntry?.kind === "tasting"
      ? { type: lastEntry.product_type, name: lastEntry.product_name }
      : null;
  const lastLine = buildLastActivityLine(lastTastingProduct);

  const insightTeaser = cachedInsight?.bourbons ?? cachedInsight?.cigars ?? null;

  const signed =
    lastEntry?.hero_image_path != null
      ? await signImagePaths(supabase, [lastEntry.hero_image_path])
      : new Map<string, string>();

  return (
    <AppShell>
      <TasteProfileHero
        firstName={profile.name_first}
        bottleCount={bourbons.length}
        cigarCount={cigars.length}
        huntingCount={snapshot.want.size}
        tastingsCount={tastingsCount}
      />

      {lastLine ? <Voice className="block mb-4 text-sm">{lastLine}</Voice> : null}

      {insightTeaser ? (
        <>
          <Divider label="Your palate" />
          <Voice className="block mb-5 text-sm">{insightTeaser}</Voice>
        </>
      ) : null}

      {lastEntry ? (
        <>
          <Divider label="Last session" />
          <div className="mb-5">
            {lastEntry.kind === "pairing" ? (
              <PairingFeedCard
                entry={lastEntry}
                signedHero={
                  lastEntry.hero_image_path ? (signed.get(lastEntry.hero_image_path) ?? null) : null
                }
              />
            ) : (
              <TastingCard
                entry={lastEntry}
                signedHero={
                  lastEntry.hero_image_path ? (signed.get(lastEntry.hero_image_path) ?? null) : null
                }
              />
            )}
            <Link
              href="/log"
              className="mt-3 inline-block text-sm text-foreground-muted hover:text-accent"
            >
              See full log →
            </Link>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
