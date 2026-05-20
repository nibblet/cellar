import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A pairing counts as "club-validated" when at least one member has logged
 * BOTH the cigar and the bourbon at the same event AND recommended both.
 *
 * The query runs as the caller; RLS allows all authenticated members to
 * read all tastings, so no escalation needed.
 *
 * Returns metadata describing the strongest validator (one member, one
 * event), suitable for "Carl B paired this in March and recommended it."
 * Returns null if no such pairing exists.
 */
export type GroupValidation = {
  user_id: string;
  display_name: string; // "Carl B"
  event_id: string;
  event_name: string;
  event_date: string; // ISO date
};

export async function checkGroupValidation(
  supabase: SupabaseClient,
  cigarId: string,
  bourbonId: string,
): Promise<GroupValidation | null> {
  // Pull all tastings of the cigar AND the bourbon by users with shared
  // (user_id, event_id). Two queries are cheaper than a self-join for a
  // 12-person club; we cross-reference in memory.
  const { data: cigarTastings } = await supabase
    .from("tastings")
    .select(
      "user_id, event_id, created_at, user:users(name_first, name_last_initial), event:events(name, date)",
    )
    .eq("product_id", cigarId)
    .eq("recommend", true)
    .not("event_id", "is", null);

  if (!cigarTastings || cigarTastings.length === 0) return null;

  const { data: bourbonTastings } = await supabase
    .from("tastings")
    .select("user_id, event_id")
    .eq("product_id", bourbonId)
    .eq("recommend", true)
    .not("event_id", "is", null);

  if (!bourbonTastings || bourbonTastings.length === 0) return null;

  const bourbonKey = new Set(bourbonTastings.map((b) => `${b.user_id}::${b.event_id}`));

  type CigarRow = {
    user_id: string;
    event_id: string;
    created_at: string;
    user: { name_first: string; name_last_initial: string } | null;
    event: { name: string; date: string } | null;
  };

  for (const t of (cigarTastings as unknown as CigarRow[]) ?? []) {
    if (!t.event_id) continue;
    if (!bourbonKey.has(`${t.user_id}::${t.event_id}`)) continue;
    if (!t.user || !t.event) continue;
    return {
      user_id: t.user_id,
      display_name: `${t.user.name_first} ${t.user.name_last_initial}`,
      event_id: t.event_id,
      event_name: t.event.name,
      event_date: t.event.date,
    };
  }

  return null;
}
