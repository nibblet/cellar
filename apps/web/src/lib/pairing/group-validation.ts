import type { SupabaseClient } from "@supabase/supabase-js";
import { formatMemberName } from "@/lib/identity";

/**
 * A pairing counts as "club-validated" when at least one member has:
 * - logged BOTH the cigar and the bourbon at the same event AND recommended both, OR
 * - captured them together via "Tasted this pairing" AND recommended both halves.
 */
export type GroupValidation =
  | {
      kind: "event";
      user_id: string;
      display_name: string;
      event_id: string;
      event_name: string;
      event_date: string;
    }
  | {
      kind: "pairing";
      user_id: string;
      display_name: string;
      validated_at: string;
    };

export async function checkGroupValidation(
  supabase: SupabaseClient,
  cigarId: string,
  bourbonId: string,
): Promise<GroupValidation | null> {
  const eventMatch = await checkEventValidation(supabase, cigarId, bourbonId);
  if (eventMatch) return eventMatch;
  return checkPairingSessionValidation(supabase, cigarId, bourbonId);
}

async function checkEventValidation(
  supabase: SupabaseClient,
  cigarId: string,
  bourbonId: string,
): Promise<GroupValidation | null> {
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
      kind: "event",
      user_id: t.user_id,
      display_name: formatMemberName(t.user),
      event_id: t.event_id,
      event_name: t.event.name,
      event_date: t.event.date,
    };
  }

  return null;
}

async function checkPairingSessionValidation(
  supabase: SupabaseClient,
  cigarId: string,
  bourbonId: string,
): Promise<GroupValidation | null> {
  const { data: sessionsRaw } = await supabase
    .from("pairing_sessions")
    .select("id, user_id, created_at, user:users(name_first, name_last_initial)")
    .eq("cigar_id", cigarId)
    .eq("bourbon_id", bourbonId)
    .order("created_at", { ascending: false })
    .limit(20);

  type SessionRow = {
    id: string;
    user_id: string;
    created_at: string;
    user: { name_first: string; name_last_initial: string } | null;
  };

  const sessions = (sessionsRaw as SessionRow[] | null) ?? [];
  if (sessions.length === 0) return null;

  const sessionIds = sessions.map((s) => s.id);
  const { data: halvesRaw } = await supabase
    .from("tastings")
    .select("pairing_session_id, product_id, recommend")
    .in("pairing_session_id", sessionIds)
    .in("product_id", [cigarId, bourbonId])
    .eq("recommend", true);

  type Half = { pairing_session_id: string; product_id: string; recommend: boolean };

  const validatedSessionIds = new Set<string>();
  const bySession = new Map<string, Set<string>>();

  for (const half of (halvesRaw as Half[] | null) ?? []) {
    if (!half.pairing_session_id || !half.recommend) continue;
    const set = bySession.get(half.pairing_session_id) ?? new Set<string>();
    set.add(half.product_id);
    bySession.set(half.pairing_session_id, set);
    if (set.has(cigarId) && set.has(bourbonId)) {
      validatedSessionIds.add(half.pairing_session_id);
    }
  }

  for (const session of sessions) {
    if (!validatedSessionIds.has(session.id) || !session.user) continue;
    return {
      kind: "pairing",
      user_id: session.user_id,
      display_name: formatMemberName(session.user),
      validated_at: session.created_at,
    };
  }

  return null;
}
