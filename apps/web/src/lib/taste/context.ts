import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCellarSnapshot } from "@/lib/cellar/load";
import type { CellarSnapshot } from "@/lib/cellar/types";
import { loadMemberPreferences } from "@/lib/preferences/load";
import type { MemberPreferences } from "@/lib/preferences/types";
import type { ProductType, TraitVector } from "@/lib/wheel";
import {
  buildTasteVector,
  COLD_START_THRESHOLD,
  type TasteSignal,
  totalSignalWeight,
} from "./vector";

export const TASTE_TYPES: ProductType[] = ["cigar", "bourbon"];

export type TasteForType = {
  /** Weighted-average of the member's tried/loved trait vectors for this type, or null. */
  tasteVector: TraitVector | null;
  signals: TasteSignal[];
  /** True once the signal clears the cold-start threshold (enough tried/loved). */
  warm: boolean;
};

export type TasteByType = Record<ProductType, TasteForType>;

type SignalProductRow = { id: string; type: ProductType; trait_vector: TraitVector | null };

function buildSignals(
  rows: SignalProductRow[],
  lovedIds: ReadonlySet<string>,
  type: ProductType,
): TasteSignal[] {
  const signals: TasteSignal[] = [];
  for (const row of rows) {
    if (row.type !== type || !row.trait_vector) continue;
    signals.push({ traitVector: row.trait_vector, loved: lovedIds.has(row.id) });
  }
  return signals;
}

/**
 * Build the per-type taste vectors from the member's tried/loved products.
 * One query, shared by Try Next (8.1) and the want-list re-rank (8.2) so the
 * signal math has a single source of truth.
 */
export async function loadTasteByType(
  supabase: SupabaseClient,
  snapshot: CellarSnapshot,
): Promise<TasteByType> {
  const triedLovedIds = [...new Set([...snapshot.tried, ...snapshot.loved])];

  const { data } = triedLovedIds.length
    ? await supabase.from("products").select("id, type, trait_vector").in("id", triedLovedIds)
    : { data: [] as SignalProductRow[] };

  const rows = (data ?? []) as SignalProductRow[];

  const byType = {} as TasteByType;
  for (const type of TASTE_TYPES) {
    const signals = buildSignals(rows, snapshot.loved, type);
    byType[type] = {
      signals,
      tasteVector: buildTasteVector(signals),
      warm: totalSignalWeight(signals) >= COLD_START_THRESHOLD,
    };
  }
  return byType;
}

export type MemberTasteContext = {
  snapshot: CellarSnapshot;
  preferences: MemberPreferences;
  byType: TasteByType;
};

/** Snapshot + preferences + per-type taste vectors in one call. */
export async function loadMemberTasteContext(
  supabase: SupabaseClient,
  memberId: string,
): Promise<MemberTasteContext> {
  const [snapshot, preferences] = await Promise.all([
    loadCellarSnapshot(supabase, memberId),
    loadMemberPreferences(supabase, memberId),
  ]);
  const byType = await loadTasteByType(supabase, snapshot);
  return { snapshot, preferences, byType };
}
