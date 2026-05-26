"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { syncPairingValidationCache } from "@/lib/pairing/sync-validation-cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveTasting } from "@/lib/tasting/save";
import type { ProductType } from "@/lib/wheel";

type State = { status: "idle" | "error"; message?: string };

const BUCKET = "product-photos";

/**
 * "Tasted this pairing" submission. One photo, two tastings — one cigar, one
 * bourbon — sharing a pairing_session_id so the feed can render them linked
 * later. Skips vision identification: we already know both products.
 */
export async function submitPairingTaste(_prev: State, formData: FormData): Promise<State> {
  const cigarId = String(formData.get("cigar_id") ?? "");
  const bourbonId = String(formData.get("bourbon_id") ?? "");
  if (!cigarId || !bourbonId) {
    return { status: "error", message: "Missing pairing context." };
  }

  const cigarRecommendRaw = String(formData.get("cigar_recommend") ?? "");
  const bourbonRecommendRaw = String(formData.get("bourbon_recommend") ?? "");
  if (
    (cigarRecommendRaw !== "yes" && cigarRecommendRaw !== "no") ||
    (bourbonRecommendRaw !== "yes" && bourbonRecommendRaw !== "no")
  ) {
    return { status: "error", message: "Pick yes or no for both halves of the pairing." };
  }

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return { status: "error", message: "Add a photo of the pairing." };
  }
  if (photo.size > 4 * 1024 * 1024) {
    return { status: "error", message: "Photo too large (4 MB max)." };
  }

  const cigarChips = formData
    .getAll("cigar_chips")
    .map((c) => String(c).trim())
    .filter(Boolean);
  const bourbonChips = formData
    .getAll("bourbon_chips")
    .map((c) => String(c).trim())
    .filter(Boolean);
  const note = (formData.get("note") as string | null)?.trim() || null;
  const bourbonReleaseLabel = (formData.get("bourbon_release_label") as string | null)?.trim() || null;
  const eventIdRaw = (formData.get("event_id") as string | null)?.trim() || null;
  const eventId = eventIdRaw && eventIdRaw !== "none" ? eventIdRaw : null;

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: "error", message: "You're not signed in." };

  // Verify both products exist and are the expected types.
  const { data: products } = await supabase
    .from("products")
    .select("id, type")
    .in("id", [cigarId, bourbonId]);
  const cigar = products?.find((p) => p.id === cigarId && p.type === "cigar");
  const bourbon = products?.find((p) => p.id === bourbonId && p.type === "bourbon");
  if (!cigar || !bourbon) {
    return { status: "error", message: "Couldn't find both products for this pairing." };
  }

  // Upload the photo once. Both product_images rows point at the same
  // storage path so the file lives in storage exactly once.
  const ext = guessExtension(photo.type) ?? "jpg";
  const storagePath = `${auth.user.id}/${randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, photo, {
    contentType: photo.type || "image/jpeg",
    upsert: false,
  });
  if (uploadError) {
    return { status: "error", message: `Upload failed: ${uploadError.message}` };
  }

  // Create one product_images row per product. They share the image_url so a
  // future feed renderer can detect the pairing-photo case by joining the
  // two tastings via pairing_session_id and noting the matching paths.
  const { data: images, error: imagesError } = await supabase
    .from("product_images")
    .insert([
      {
        product_id: cigarId,
        image_url: storagePath,
        contributed_by: auth.user.id,
      },
      {
        product_id: bourbonId,
        image_url: storagePath,
        contributed_by: auth.user.id,
      },
    ])
    .select("id, product_id");
  if (imagesError || !images || images.length !== 2) {
    return {
      status: "error",
      message: `Couldn't attach photo: ${imagesError?.message ?? "no rows"}`,
    };
  }

  const cigarImageId = images.find((i) => i.product_id === cigarId)?.id ?? null;
  const bourbonImageId = images.find((i) => i.product_id === bourbonId)?.id ?? null;

  const { data: sessionRow, error: sessionError } = await supabase
    .from("pairing_sessions")
    .insert({
      user_id: auth.user.id,
      cigar_id: cigarId,
      bourbon_id: bourbonId,
      pairing_note: note,
      event_id: eventId,
      photo_storage_path: storagePath,
    })
    .select("id")
    .single();

  if (sessionError || !sessionRow) {
    return {
      status: "error",
      message: `Couldn't start pairing session: ${sessionError?.message ?? "no row"}`,
    };
  }

  const pairingSessionId = sessionRow.id;

  try {
    await Promise.all([
      saveTasting({
        supabase,
        userId: auth.user.id,
        productId: cigarId,
        productType: "cigar" as ProductType,
        recommend: cigarRecommendRaw === "yes",
        chips: cigarChips,
        note,
        eventId,
        pairingSessionId,
        photoImageId: cigarImageId,
      }),
      saveTasting({
        supabase,
        userId: auth.user.id,
        productId: bourbonId,
        productType: "bourbon" as ProductType,
        recommend: bourbonRecommendRaw === "yes",
        chips: bourbonChips,
        note,
        eventId,
        pairingSessionId,
        photoImageId: bourbonImageId,
        releaseLabel: bourbonReleaseLabel,
        releaseLabelSource: bourbonReleaseLabel ? "member" : null,
      }),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't save the pairing.";
    return { status: "error", message };
  }

  if (cigarRecommendRaw === "yes" && bourbonRecommendRaw === "yes") {
    void syncPairingValidationCache(supabase, cigarId, bourbonId);
  }

  // Land back on the pairing page with a confirmation cue.
  redirect(`/pairings/${cigarId}/${bourbonId}?just_tasted=1`);
}

function guessExtension(mime: string): string | null {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    default:
      return null;
  }
}
