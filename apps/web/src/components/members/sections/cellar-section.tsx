import { CellarTab } from "@/components/cellar";
import { loadCellarProducts, loadCellarSnapshot } from "@/lib/cellar/load";
import { loadMemberPreferences } from "@/lib/preferences/load";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadTasteByType } from "@/lib/taste/context";
import { type RankableWant, rankWants } from "@/lib/taste/want";
import type { ProductType, TraitVector } from "@/lib/wheel";

type WantMetaRow = {
  id: string;
  type: ProductType;
  specs: Record<string, unknown> | null;
  trait_vector: TraitVector | null;
};

export async function CellarSection({
  memberId,
  memberFirstName,
  isOwnProfile,
}: {
  memberId: string;
  memberFirstName: string;
  isOwnProfile: boolean;
}) {
  const supabase = await createSupabaseServerClient();
  const [have, want, tried, snapshot] = await Promise.all([
    loadCellarProducts(supabase, memberId, "have"),
    loadCellarProducts(supabase, memberId, "want"),
    loadCellarProducts(supabase, memberId, "tried"),
    loadCellarSnapshot(supabase, memberId),
  ]);

  // 8.2 — re-rank my own wishlist by palate fit (a re-sort, never a filter).
  // Other members' wishlists stay chronological; the ranking is personal to me.
  let orderedWant = want;
  let wantBestMatchId: string | null = null;

  if (isOwnProfile && want.length > 1) {
    const wantIds = want.map((w) => w.product_id);
    const [{ data: metaRows }, byType, preferences] = await Promise.all([
      supabase.from("products").select("id, type, specs, trait_vector").in("id", wantIds),
      loadTasteByType(supabase, snapshot),
      loadMemberPreferences(supabase, memberId),
    ]);

    const metaById = new Map(((metaRows ?? []) as WantMetaRow[]).map((r) => [r.id, r]));
    const rankable: RankableWant[] = want.map((w) => {
      const meta = metaById.get(w.product_id);
      return {
        id: w.product_id,
        type: (meta?.type ?? w.type) as ProductType,
        specs: meta?.specs ?? null,
        traitVector: meta?.trait_vector ?? null,
      };
    });

    const ranking = rankWants(rankable, byType, preferences);
    const orderIndex = new Map(ranking.orderedIds.map((id, i) => [id, i]));
    orderedWant = [...want].sort(
      (a, b) => (orderIndex.get(a.product_id) ?? 0) - (orderIndex.get(b.product_id) ?? 0),
    );
    wantBestMatchId = ranking.bestMatchId;
  }

  return (
    <CellarTab
      have={have}
      want={orderedWant}
      tried={tried}
      lovedProductIds={[...snapshot.loved]}
      wantBestMatchId={wantBestMatchId}
      isOwnProfile={isOwnProfile}
      memberFirstName={memberFirstName}
    />
  );
}
