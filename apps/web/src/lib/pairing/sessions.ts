import type { SupabaseClient } from "@supabase/supabase-js";

export type PairingSessionSummary = {
  id: string;
  user_id: string;
  cigar_id: string;
  cigar_name: string;
  cigar_brand: string | null;
  bourbon_id: string;
  bourbon_name: string;
  bourbon_brand: string | null;
  pairing_note: string | null;
  created_at: string;
  both_recommended: boolean;
  photo_storage_path: string | null;
};

type SessionRow = {
  id: string;
  user_id: string;
  cigar_id: string;
  bourbon_id: string;
  pairing_note: string | null;
  created_at: string;
  photo_storage_path: string | null;
  cigar: { name: string; brand: string | null } | null;
  bourbon: { name: string; brand: string | null } | null;
};

/**
 * Pairing captures for a member, newest first. `both_recommended` is true when
 * the linked tastings for this session both have recommend = true.
 */
export async function loadMemberPairingSessions(
  supabase: SupabaseClient,
  memberId: string,
  limit = 50,
): Promise<PairingSessionSummary[]> {
  const { data: sessionsRaw } = await supabase
    .from("pairing_sessions")
    .select(
      `
      id, user_id, cigar_id, bourbon_id, pairing_note, created_at, photo_storage_path,
      cigar:cigar_id(name, brand),
      bourbon:bourbon_id(name, brand)
    `,
    )
    .eq("user_id", memberId)
    .order("created_at", { ascending: false })
    .limit(limit);

  const sessions = (sessionsRaw as SessionRow[] | null) ?? [];
  if (sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);
  const { data: tastingsRaw } = await supabase
    .from("tastings")
    .select("pairing_session_id, product_id, recommend")
    .eq("user_id", memberId)
    .in("pairing_session_id", sessionIds);

  type TastingHalf = {
    pairing_session_id: string;
    product_id: string;
    recommend: boolean;
  };

  const halves = (tastingsRaw as TastingHalf[] | null) ?? [];
  const recommendBySession = new Map<string, { cigar?: boolean; bourbon?: boolean }>();

  for (const session of sessions) {
    recommendBySession.set(session.id, {});
  }

  for (const t of halves) {
    if (!t.pairing_session_id) continue;
    const bucket = recommendBySession.get(t.pairing_session_id);
    if (!bucket) continue;
    const session = sessions.find((s) => s.id === t.pairing_session_id);
    if (!session) continue;
    if (t.product_id === session.cigar_id) bucket.cigar = t.recommend;
    if (t.product_id === session.bourbon_id) bucket.bourbon = t.recommend;
  }

  return sessions.flatMap((s) => {
    if (!s.cigar || !s.bourbon) return [];
    const rec = recommendBySession.get(s.id);
    return [
      {
        id: s.id,
        user_id: s.user_id,
        cigar_id: s.cigar_id,
        cigar_name: s.cigar.name,
        cigar_brand: s.cigar.brand,
        bourbon_id: s.bourbon_id,
        bourbon_name: s.bourbon.name,
        bourbon_brand: s.bourbon.brand,
        pairing_note: s.pairing_note,
        created_at: s.created_at,
        both_recommended: Boolean(rec?.cigar && rec?.bourbon),
        photo_storage_path: s.photo_storage_path,
      },
    ];
  });
}

export async function countMemberPairingSessions(
  supabase: SupabaseClient,
  memberId: string,
): Promise<number> {
  const { count } = await supabase
    .from("pairing_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", memberId);
  return count ?? 0;
}
