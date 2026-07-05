import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { CellarSection } from "@/components/members/sections";
import { Divider, Voice } from "@/components/primitives";
import { loadCachedInsight } from "@/lib/cellar/insight";
import {
  APP_HOME_PATH,
  PERSONAL_PAIRINGS_PATH,
  PERSONAL_TASTINGS_PATH,
} from "@/lib/navigation/paths";
import { countMemberPairingSessions, loadMemberPairingSessions } from "@/lib/pairing/sessions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PersonalCard, type PersonalCardThumb } from "./_components/personal-card";

export default async function YouHubPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const me = auth.user.id;

  const [profileResult, recentTastingsResult, tastingsCountResult, pairingsCount, recentPairings, cachedInsight] =
    await Promise.all([
      supabase
        .from("users")
        .select("id, name_first, name_last_initial")
        .eq("id", me)
        .maybeSingle(),
      supabase
        .from("tastings")
        .select("id, product_id, product:products(id, name, image_url, type), created_at")
        .eq("user_id", me)
        .order("created_at", { ascending: false })
        .limit(3),
      supabase.from("tastings").select("id", { count: "exact", head: true }).eq("user_id", me),
      countMemberPairingSessions(supabase, me),
      loadMemberPairingSessions(supabase, me, 3),
      loadCachedInsight(supabase, me),
    ]);

  if (!profileResult.data) redirect("/login");
  const profile = profileResult.data;

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

  const tastingsCount = tastingsCountResult.count ?? 0;
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

  const insightTeaser = cachedInsight?.bourbons ?? cachedInsight?.cigars ?? null;

  return (
    <AppShell>
      <header className="mb-5">
        <h1 className="text-3xl">You</h1>
      </header>

      {lastVoice ? <Voice className="block mb-4 text-sm">{lastVoice}</Voice> : null}

      <Divider label="Personal" />

      <div className="flex flex-col gap-3">
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

      <Divider label="Your cellar" />

      {insightTeaser ? <Voice className="block mb-4 text-sm">{insightTeaser}</Voice> : null}

      <div id="shelf">
        <CellarSection memberId={me} memberFirstName={profile.name_first} isOwnProfile={true} />
      </div>
    </AppShell>
  );
}
