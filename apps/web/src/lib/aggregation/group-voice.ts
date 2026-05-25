import type { SupabaseClient } from "@supabase/supabase-js";
import { formatMemberName, type MemberNameFields } from "@/lib/identity";
import type { ProductType, WheelVector } from "@/lib/wheel";
import { getWheel } from "@/lib/wheel";

export type MemberTake = {
  user_id: string;
  display_name: string; // "Paul C"
  recommend: boolean;
  chips: string[];
  note: string | null;
  release_label: string | null;
  created_at: string;
};

export type TagCloudEntry = {
  leaf_id: string;
  label: string;
  category_id: string; // wheel branch the leaf belongs to (e.g. "wood", "earth")
  category_label: string; // display label for the branch (e.g. "Wood", "Earth")
  score: number; // 0..1 normalized weight for sizing
  raw: number; // sum of intensities (for tie-break / debug)
  mentions: number; // how many tastings included this leaf
};

export type GroupVoice = {
  member_count: number; // total members who logged a tasting
  recommend_count: number; // those that hit "Recommend to NCCC"
  takes: MemberTake[]; // newest first
  tag_cloud: TagCloudEntry[]; // top leaves by frequency, descending
};

/**
 * Compose the full group-voice payload for a product. One round trip; the
 * tag cloud + counts are computed in memory from the raw tasting rows.
 *
 * RLS already lets every authenticated member read every tasting, so this
 * runs as the caller — no service-role escalation needed.
 */
export async function loadGroupVoice(
  supabase: SupabaseClient,
  productId: string,
  productType: ProductType,
): Promise<GroupVoice> {
  const { data: rows } = await supabase
    .from("tastings")
    .select(
      "user_id, recommend, chips, note, release_label, wheel_vector, created_at, user:users(name_first, name_last_initial)",
    )
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  type Row = {
    user_id: string;
    recommend: boolean;
    chips: string[];
    note: string | null;
    release_label: string | null;
    wheel_vector: WheelVector;
    created_at: string;
    user: MemberNameFields | null;
  };

  const tastings = ((rows as Row[] | null) ?? []).filter((r) => r.user !== null);

  const takes: MemberTake[] = tastings.map((t) => ({
    user_id: t.user_id,
    display_name: t.user ? formatMemberName(t.user) : "Member",
    recommend: t.recommend,
    chips: t.chips ?? [],
    note: t.note,
    release_label: t.release_label,
    created_at: t.created_at,
  }));

  const recommend_count = tastings.reduce((n, t) => (t.recommend ? n + 1 : n), 0);

  const tag_cloud = buildTagCloud(
    productType,
    tastings.map((t) => t.wheel_vector ?? {}),
  );

  return {
    member_count: tastings.length,
    recommend_count,
    takes,
    tag_cloud,
  };
}

/**
 * Aggregate a set of wheel vectors into a ranked tag cloud. Sum intensities
 * per leaf, sort descending, normalize the top entry to 1.0 so the renderer
 * can scale font-size off it.
 *
 * Exported separately for unit testing without a Supabase client.
 */
export function buildTagCloud(
  productType: ProductType,
  vectors: WheelVector[],
  maxEntries = 8,
): TagCloudEntry[] {
  if (vectors.length === 0) return [];

  const totals: Record<string, { raw: number; mentions: number }> = {};
  for (const v of vectors) {
    for (const [leafId, score] of Object.entries(v)) {
      if (typeof score !== "number" || score < 1) continue;
      const entry = totals[leafId] ?? { raw: 0, mentions: 0 };
      entry.raw += score;
      entry.mentions += 1;
      totals[leafId] = entry;
    }
  }

  const wheel = getWheel(productType);
  const leafIndex = new Map(wheel.leaves.map((l) => [l.id, l] as const));
  const categoryIndex = new Map(wheel.categories.map((c) => [c.id, c.label] as const));

  const ranked = Object.entries(totals)
    .map(([leaf_id, { raw, mentions }]) => {
      const leaf = leafIndex.get(leaf_id);
      const category_id = leaf?.category_id ?? "";
      return {
        leaf_id,
        label: leaf?.label ?? leaf_id,
        category_id,
        category_label: categoryIndex.get(category_id) ?? category_id,
        raw,
        mentions,
        score: 0, // normalized below
      };
    })
    .sort((a, b) => b.raw - a.raw || b.mentions - a.mentions)
    .slice(0, maxEntries);

  const maxRaw = ranked[0]?.raw ?? 0;
  if (maxRaw > 0) {
    for (const entry of ranked) entry.score = entry.raw / maxRaw;
  }

  return ranked;
}
