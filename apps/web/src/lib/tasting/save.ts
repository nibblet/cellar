import type { SupabaseClient } from "@supabase/supabase-js";
import { fallbackMapFromChips, mapChipsAndNoteToWheel } from "@/lib/openai/map-wheel";
import type { ProductType } from "@/lib/wheel";

const WHEEL_VERSION = "0.1";

type SaveTastingArgs = {
  supabase: SupabaseClient;
  userId: string;
  productId: string;
  productType: ProductType;
  recommend: boolean;
  chips: string[];
  note: string | null;
  eventId?: string | null;
};

/**
 * Insert a tasting row immediately with the fallback-mapped wheel vector,
 * then asynchronously refine via the LLM mapper and update in place.
 *
 * The user's redirect happens after the synchronous insert — they don't wait
 * for the LLM call. If the LLM update fails or arrives late, the tasting
 * still has a usable wheel vector from the chip synonyms.
 */
export async function saveTasting(args: SaveTastingArgs): Promise<{ tastingId: string }> {
  const { supabase, userId, productId, productType, recommend, chips, note, eventId } = args;

  // Fast path: synonym-mapped vector lets us redirect immediately.
  const seedVector = fallbackMapFromChips(productType, chips);

  const { data: created, error: insertError } = await supabase
    .from("tastings")
    .upsert(
      {
        user_id: userId,
        product_id: productId,
        event_id: eventId ?? null,
        recommend,
        chips,
        note: note?.trim() || null,
        wheel_version: WHEEL_VERSION,
        wheel_vector: seedVector,
      },
      { onConflict: "user_id,product_id" },
    )
    .select("id")
    .single();

  if (insertError || !created) {
    throw new Error(`Failed to save tasting: ${insertError?.message ?? "no row"}`);
  }

  // Fire-and-forget LLM refinement. Caller doesn't await this.
  void refineTastingVector({
    supabase,
    userId,
    tastingId: created.id,
    productType,
    chips,
    note: note?.trim() || null,
  });

  return { tastingId: created.id };
}

async function refineTastingVector(args: {
  supabase: SupabaseClient;
  userId: string;
  tastingId: string;
  productType: ProductType;
  chips: string[];
  note: string | null;
}): Promise<void> {
  // No point calling the LLM if there's nothing to refine over.
  if (args.chips.length === 0 && !args.note) return;

  try {
    const { vector } = await mapChipsAndNoteToWheel({
      type: args.productType,
      chips: args.chips,
      note: args.note,
      supabase: args.supabase,
      userId: args.userId,
    });

    if (Object.keys(vector).length === 0) return;

    await args.supabase.from("tastings").update({ wheel_vector: vector }).eq("id", args.tastingId);

    // Note: product-level aggregate wheel/trait vectors stay catalog-seeded
    // in Phase 3. Aggregation across member tastings lands in Phase 4 along
    // with the group-voice view — we want it computed against confirmed group
    // signal, not the first member's first tasting.
  } catch (err) {
    console.warn("[refineTastingVector] LLM mapper failed:", err);
  }
}
