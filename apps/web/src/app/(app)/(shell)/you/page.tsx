import { redirect } from "next/navigation";
import { Suspense } from "react";
import { TonightsPickSkeleton, TryNext, TryNextSkeleton } from "@/components/cellar";
import { AppShell } from "@/components/layout/app-shell";
import { Divider, Voice } from "@/components/primitives";
import { TonightsPickSection } from "@/components/you/tonights-pick-section";
import { loadCellarSnapshot } from "@/lib/cellar/load";
import {
  CELLAR_PATH,
  PERSONAL_PAIRINGS_PATH,
  PERSONAL_TASTINGS_PATH,
} from "@/lib/navigation/paths";
import { countMemberPairingSessions, loadMemberPairingSessions } from "@/lib/pairing/sessions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureTasteRecommendations } from "@/lib/taste";
import { PersonalCard, type PersonalCardThumb } from "./_components/personal-card";

export default async function YouHubPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const me = auth.user.id;

  const [cellarSnapshot, recentTastingsResult, tastingsCountResult, pairingsCount, recentPairings] =
    await Promise.all([
      loadCellarSnapshot(supabase, me),
      supabase
        .from("tastings")
        .select("id, product_id, product:products(id, name, image_url, type), created_at")
        .eq("user_id", me)
        .order("created_at", { ascending: false })
        .limit(3),
      supabase.from("tastings").select("id", { count: "exact", head: true }).eq("user_id", me),
      countMemberPairingSessions(supabase, me),
      loadMemberPairingSessions(supabase, me, 3),
    ]);

  type TastingRow = {
    id: string;
    product_id: string;
    created_at: string;
    product: { id: string; name: string; image_url: string | null; type: string } | null;
  };
  const recentTastings = (recentTastingsResult.data as TastingRow[] | null) ?? [];
  const lastTasting = recentTastings[0] ?? null;
  const tastingThumbs: PersonalCardThumb[] = recentTastings
    .filter((t): t is TastingRow & { product: NonNullable<TastingRow["product"]> } =>
      Boolean(t.product),
    )
    .map((t) => ({
      productId: t.product.id,
      name: t.product.name,
      imageUrl: t.product.image_url,
    }));

  const haveIds = Array.from(cellarSnapshot.have).slice(0, 3);
  let cellarThumbs: PersonalCardThumb[] = [];
  if (haveIds.length > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("id, name, image_url")
      .in("id", haveIds);
    cellarThumbs = (
      (products ?? []) as { id: string; name: string; image_url: string | null }[]
    ).map((p) => ({ productId: p.id, name: p.name, imageUrl: p.image_url }));
  }

  const tastingsCount = tastingsCountResult.count ?? 0;
  const cellarCounts = `${cellarSnapshot.have.size} have · ${cellarSnapshot.want.size} want · ${cellarSnapshot.tried.size} tried`;
  const tastingsCountStr = `${tastingsCount} logged`;
  const pairingsCountStr = `${pairingsCount} captured`;
  const pairingThumbs: PersonalCardThumb[] = recentPairings.map((p) => ({
    productId: p.cigar_id,
    name: `${p.cigar_name} + ${p.bourbon_name}`,
    imageUrl: null,
  }));

  const lastVoice = lastTasting?.product
    ? lastTasting.product.type === "bourbon"
      ? `"You poured ${lastTasting.product.name} last."`
      : `"You lit ${lastTasting.product.name} last."`
    : null;

  return (
    <AppShell>
      <header className="mb-5">
        <h1 className="text-3xl">You</h1>
      </header>

      {lastVoice ? <Voice className="block mb-4 text-sm">{lastVoice}</Voice> : null}

      <Suspense fallback={<TonightsPickSkeleton />}>
        <TonightsPickSection memberId={me} />
      </Suspense>

      <Suspense fallback={<TryNextSkeleton />}>
        <TryNextSection memberId={me} />
      </Suspense>

      <Divider label="Your archive" />

      <div className="flex flex-col gap-3">
        <PersonalCard
          title="Your cellar"
          counts={cellarCounts}
          thumbs={cellarThumbs}
          href={CELLAR_PATH}
          emptyVoice='"The shelf is bare. Mark a few on hand."'
        />
        <PersonalCard
          title="Your tastings"
          counts={tastingsCountStr}
          thumbs={tastingThumbs}
          href={PERSONAL_TASTINGS_PATH}
          emptyVoice='"Nothing logged yet. Snap something next time you light up."'
        />
        <PersonalCard
          title="Your pairings"
          counts={pairingsCountStr}
          thumbs={pairingThumbs}
          href={PERSONAL_PAIRINGS_PATH}
          emptyVoice='"No pairings captured yet. Pick a cigar and a pour."'
        />
      </div>
    </AppShell>
  );
}

async function TryNextSection({ memberId }: { memberId: string }) {
  const supabase = await createSupabaseServerClient();
  const recommendations = await ensureTasteRecommendations(supabase, memberId);
  if (recommendations.cigars.length === 0 && recommendations.bourbons.length === 0) return null;

  return (
    <>
      <Divider label="Worth hunting" />
      <TryNext cigars={recommendations.cigars} bourbons={recommendations.bourbons} />
    </>
  );
}
