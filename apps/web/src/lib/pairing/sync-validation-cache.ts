import type { SupabaseClient } from "@supabase/supabase-js";
import type { TraitVector } from "@/lib/wheel";
import { checkGroupValidation } from "./group-validation";
import { scorePair } from "./score";

/**
 * After a pairing capture (or event-tagged tastings), re-check club validation
 * and persist the moss flag on pairings_cache so list surfaces can filter on it.
 */
export async function syncPairingValidationCache(
  supabase: SupabaseClient,
  cigarId: string,
  bourbonId: string,
): Promise<void> {
  const validated = await checkGroupValidation(supabase, cigarId, bourbonId);

  const { data: existing } = await supabase
    .from("pairings_cache")
    .select("score")
    .eq("cigar_id", cigarId)
    .eq("bourbon_id", bourbonId)
    .maybeSingle();

  let score = existing?.score ?? null;

  if (score == null) {
    const { data: products } = await supabase
      .from("products")
      .select("id, trait_vector")
      .in("id", [cigarId, bourbonId]);

    type Row = { id: string; trait_vector: TraitVector | null };
    const cigar = (products as Row[] | null)?.find((p) => p.id === cigarId);
    const bourbon = (products as Row[] | null)?.find((p) => p.id === bourbonId);
    if (cigar?.trait_vector && bourbon?.trait_vector) {
      score = scorePair(cigar.trait_vector, bourbon.trait_vector).score;
    } else {
      score = 50;
    }
  }

  await supabase.from("pairings_cache").upsert(
    {
      cigar_id: cigarId,
      bourbon_id: bourbonId,
      score,
      is_group_validated: validated != null,
      last_computed_at: new Date().toISOString(),
    },
    { onConflict: "cigar_id,bourbon_id" },
  );
}
