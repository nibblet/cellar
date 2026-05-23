import type { SupabaseClient } from "@supabase/supabase-js";
import { applyCellarBias } from "@/lib/cellar/bias";
import { loadCellarSnapshot } from "@/lib/cellar/load";
import type { CellarSnapshot } from "@/lib/cellar/types";
import { compareCandidatesForSelection, type DailyPourCandidate } from "@/lib/daily-pour/load";
import { scorePair } from "@/lib/pairing/score";
import type { TraitVector } from "@/lib/wheel";

const MAX_CIGARS = 10;

/** Both legs must be on the member's Have shelf — never Want or catalog. */
export function isHaveShelfPair(
  candidate: Pick<DailyPourCandidate, "cigar_id" | "bourbon_id">,
  have: Set<string>,
): boolean {
  return have.has(candidate.cigar_id) && have.has(candidate.bourbon_id);
}

type ProductTypeRow = { id: string; type: string };

/** Split product ids into cigar vs bourbon lists (stable name order). */
export function splitIdsByProductType(rows: ProductTypeRow[]): {
  cigars: string[];
  bourbons: string[];
} {
  const cigars: string[] = [];
  const bourbons: string[] = [];
  for (const row of rows) {
    if (row.type === "cigar") cigars.push(row.id);
    else if (row.type === "bourbon") bourbons.push(row.id);
  }
  return { cigars, bourbons };
}

/**
 * Build the on-demand pick pool from Have×Have only. Never falls back to the
 * catalog or Want list — "Pick from my cellar" means both legs are on Have.
 */
export async function loadPickPourCandidates(
  supabase: SupabaseClient,
  memberId: string,
): Promise<DailyPourCandidate[]> {
  const cellar = await loadCellarSnapshot(supabase, memberId);

  if (cellar.have.size === 0) return [];

  const haveRows = await loadProductTypes(supabase, cellar.have);
  const { cigars: haveCigars, bourbons: haveBourbons } = splitIdsByProductType(haveRows);

  if (haveCigars.length === 0 || haveBourbons.length === 0) return [];

  const candidates = await buildPairsFromSets(
    supabase,
    haveCigars.slice(0, MAX_CIGARS),
    new Set(haveBourbons),
    cellar,
  );

  return candidates.filter((c) => isHaveShelfPair(c, cellar.have));
}

async function loadProductTypes(
  supabase: SupabaseClient,
  ids: Set<string>,
): Promise<ProductTypeRow[]> {
  if (ids.size === 0) return [];

  // Match the Cellar tab: any saved product counts, not just confirmed catalog rows.
  const { data } = await supabase
    .from("products")
    .select("id, type")
    .in("id", [...ids]);

  return (data as ProductTypeRow[] | null) ?? [];
}

async function buildPairsFromSets(
  supabase: SupabaseClient,
  cigarIds: string[],
  bourbonIds: Set<string>,
  cellar: CellarSnapshot,
): Promise<DailyPourCandidate[]> {
  if (cigarIds.length === 0 || bourbonIds.size === 0) return [];

  const { data: cigarMeta } = await supabase
    .from("products")
    .select("id, name, brand")
    .in("id", cigarIds);

  type CigarMeta = { id: string; name: string; brand: string | null };
  const metaById = new Map(((cigarMeta as CigarMeta[] | null) ?? []).map((c) => [c.id, c]));

  const computed: (DailyPourCandidate | null)[] = await Promise.all(
    cigarIds.map(async (cigarId): Promise<DailyPourCandidate | null> => {
      const meta = metaById.get(cigarId);
      if (!meta) return null;

      const match = await loadBestBourbonInSet(supabase, cigarId, bourbonIds);
      if (!match) return null;

      return {
        cigar_id: cigarId,
        cigar_name: meta.name,
        cigar_brand: meta.brand,
        bourbon_id: match.bourbon_id,
        bourbon_name: match.bourbon_name,
        bourbon_brand: match.bourbon_brand,
        score: match.score,
        rationale: null,
        club_validated: match.club_validated,
      };
    }),
  );

  const candidates = computed.filter((c): c is DailyPourCandidate => c !== null);

  return candidates
    .map((c) => ({
      ...c,
      score: applyCellarBias(c.score, cellar, c.cigar_id, c.bourbon_id),
    }))
    .sort(compareCandidatesForSelection);
}

type BourbonMatch = {
  bourbon_id: string;
  bourbon_name: string;
  bourbon_brand: string | null;
  score: number;
  club_validated: boolean;
};

async function loadBestBourbonInSet(
  supabase: SupabaseClient,
  cigarId: string,
  bourbonIds: Set<string>,
): Promise<BourbonMatch | null> {
  type CacheRow = {
    bourbon_id: string;
    score: number;
    is_group_validated: boolean;
    bourbon: { name: string; brand: string | null } | null;
  };

  const { data } = await supabase
    .from("pairings_cache")
    .select("bourbon_id, score, is_group_validated, bourbon:bourbon_id(name, brand)")
    .eq("cigar_id", cigarId)
    .in("bourbon_id", [...bourbonIds])
    .order("score", { ascending: false })
    .limit(1);

  const row = ((data as unknown as CacheRow[] | null) ?? [])[0];
  if (row?.bourbon && bourbonIds.has(row.bourbon_id)) {
    return {
      bourbon_id: row.bourbon_id,
      bourbon_name: row.bourbon.name,
      bourbon_brand: row.bourbon.brand,
      score: row.score,
      club_validated: Boolean(row.is_group_validated),
    };
  }

  // Score every Have bourbon directly — the global top-20 often excludes cellar bottles.
  return scoreBestBourbonInSet(supabase, cigarId, bourbonIds);
}

async function scoreBestBourbonInSet(
  supabase: SupabaseClient,
  cigarId: string,
  bourbonIds: Set<string>,
): Promise<BourbonMatch | null> {
  type ProductVec = {
    id: string;
    name: string;
    brand: string | null;
    trait_vector: TraitVector | null;
  };

  const [{ data: cigar }, { data: bourbons }] = await Promise.all([
    supabase.from("products").select("trait_vector").eq("id", cigarId).maybeSingle(),
    supabase
      .from("products")
      .select("id, name, brand, trait_vector")
      .in("id", [...bourbonIds])
      .not("trait_vector", "is", null),
  ]);

  const cigarVec = (cigar as { trait_vector: TraitVector | null } | null)?.trait_vector;
  if (!cigarVec) return null;

  let best: BourbonMatch | null = null;
  for (const b of (bourbons as ProductVec[] | null) ?? []) {
    if (!b.trait_vector || !bourbonIds.has(b.id)) continue;
    const { score } = scorePair(cigarVec, b.trait_vector);
    if (!best || score > best.score) {
      best = {
        bourbon_id: b.id,
        bourbon_name: b.name,
        bourbon_brand: b.brand,
        score,
        club_validated: false,
      };
    }
  }

  return best;
}
