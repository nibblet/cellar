import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type BadgeComputeInput,
  type BadgeEventRow,
  type BadgeTastingRow,
  type BadgeWinstonPair,
  badgesForMember,
  computeMemberBadges,
} from "./compute";
import type { MemberBadge, MemberBadgeId } from "./definitions";

export type { MemberBadge, MemberBadgeId };

export { badgesForMember, computeMemberBadges };

export async function loadMemberBadges(
  supabase: SupabaseClient,
): Promise<Map<string, MemberBadge[]>> {
  const [membersResult, tastingsResult, eventsResult, winstonResult] = await Promise.all([
    supabase.from("users").select("id, joined_at"),
    supabase
      .from("tastings")
      .select("user_id, product_id, recommend, created_at, event_id, product:products(type)"),
    supabase.from("events").select("id, date, host_user_id"),
    supabase
      .from("pairings_cache")
      .select("cigar_id, bourbon_id")
      .not("rationale_text", "is", null),
  ]);

  type TastingQueryRow = {
    user_id: string;
    product_id: string;
    recommend: boolean;
    created_at: string;
    event_id: string | null;
    product: { type: "cigar" | "bourbon" } | null;
  };

  const tastings: BadgeTastingRow[] = (
    (tastingsResult.data as TastingQueryRow[] | null) ?? []
  ).flatMap((row) => {
    const type = row.product?.type;
    if (type !== "cigar" && type !== "bourbon") return [];
    return [
      {
        user_id: row.user_id,
        product_id: row.product_id,
        product_type: type,
        recommend: row.recommend,
        created_at: row.created_at,
        event_id: row.event_id,
      },
    ];
  });

  const input: BadgeComputeInput = {
    members: (membersResult.data ?? []) as BadgeComputeInput["members"],
    tastings,
    events: (eventsResult.data ?? []) as BadgeEventRow[],
    winstonPairs: (winstonResult.data ?? []) as BadgeWinstonPair[],
  };

  return computeMemberBadges(input);
}
