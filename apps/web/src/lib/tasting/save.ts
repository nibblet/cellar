import type { SupabaseClient } from "@supabase/supabase-js";
import { fallbackMapFromChips, mapChipsAndNoteToWheel } from "@/lib/openai/map-wheel";
import type { ProductType } from "@/lib/wheel";
import { backfillProductVectorIfMissing } from "./aggregate";

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
  /** When set, this tasting is half of a "Tasted this pairing" capture. */
  pairingSessionId?: string | null;
  /** product_images row to attach as the tasting's photo. */
  photoImageId?: string | null;
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
  const {
    supabase,
    userId,
    productId,
    productType,
    recommend,
    chips,
    note,
    eventId,
    pairingSessionId,
    photoImageId,
  } = args;

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
        pairing_session_id: pairingSessionId ?? null,
        photo_image_id: photoImageId ?? null,
      },
      { onConflict: "user_id,product_id" },
    )
    .select("id")
    .single();

  if (insertError || !created) {
    throw new Error(`Failed to save tasting: ${insertError?.message ?? "no row"}`);
  }

  // Immediately give vectorless products (drafts, seed gaps) a usable
  // trait_vector from this first tasting so the pairing engine can place
  // them. The LLM refine below repeats this with a better wheel vector.
  void backfillProductVectorIfMissing(supabase, productId);

  // Fire-and-forget LLM refinement. Caller doesn't await this.
  void refineTastingVector({
    supabase,
    userId,
    productId,
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
  productId: string;
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

    // Re-run the product-level backfill with the refined vector. Still gated
    // on the product currently lacking a trait_vector, so seeded products
    // remain untouched.
    await backfillProductVectorIfMissing(args.supabase, args.productId);
  } catch (err) {
    console.warn("[refineTastingVector] LLM mapper failed:", err);
  }
}
