"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createDraftProduct } from "@/lib/identify";
import { syncPairingValidationCache } from "@/lib/pairing/sync-validation-cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveTasting } from "@/lib/tasting/save";
import type { ProductType } from "@/lib/wheel";

type State = { status: "idle" | "error"; message?: string };

const BUCKET = "product-photos";

/**
 * Pairing capture save. One photo, two tastings sharing pairing_session_id.
 * Accepts pre-uploaded photo_storage_path (photo-first flow) or a File upload.
 */
export async function submitPairingTaste(_prev: State, formData: FormData): Promise<State> {
  const cigarIdRaw = String(formData.get("cigar_id") ?? "");
  const bourbonIdRaw = String(formData.get("bourbon_id") ?? "");
  if (!cigarIdRaw || !bourbonIdRaw) {
    return { status: "error", message: "Missing pairing context." };
  }

  const recommendRaw = String(formData.get("recommend") ?? "");
  if (recommendRaw !== "yes" && recommendRaw !== "no") {
    return { status: "error", message: "Pick recommend or just logging for this pairing." };
  }
  const recommend = recommendRaw === "yes";

  const chips = formData
    .getAll("pairing_chips")
    .concat(formData.getAll("cigar_chips"))
    .concat(formData.getAll("bourbon_chips"))
    .map((c) => String(c).trim())
    .filter(Boolean);

  const uniqueChips = [...new Set(chips)];

  const note = (formData.get("note") as string | null)?.trim() || null;
  const bourbonReleaseLabel =
    (formData.get("bourbon_release_label") as string | null)?.trim() || null;
  const visionReleaseLabel =
    (formData.get("vision_release_label") as string | null)?.trim() || null;
  const eventIdRaw = (formData.get("event_id") as string | null)?.trim() || null;
  const eventId = eventIdRaw && eventIdRaw !== "none" ? eventIdRaw : null;

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: "error", message: "You're not signed in." };

  let cigarId = cigarIdRaw;
  let bourbonId = bourbonIdRaw;

  const { data: products } = await supabase
    .from("products")
    .select("id, type, name, brand, specs")
    .in("id", [cigarId, bourbonId]);

  let cigar = products?.find((p) => p.id === cigarId && p.type === "cigar");
  let bourbon = products?.find((p) => p.id === bourbonId && p.type === "bourbon");

  if (!cigar) {
    const name = (formData.get("cigar_extracted_name") as string | null)?.trim();
    if (!name) {
      return { status: "error", message: "Pick a cigar from the catalog." };
    }
    cigarId = await createDraftProduct(supabase, auth.user.id, "cigar", {
      name,
      brand: (formData.get("cigar_extracted_brand") as string | null)?.trim() || null,
      specs: {},
    });
    const { data: row } = await supabase
      .from("products")
      .select("id, type, name, brand, specs")
      .eq("id", cigarId)
      .single();
    cigar = row ?? undefined;
  }

  if (!bourbon) {
    const name = (formData.get("bourbon_extracted_name") as string | null)?.trim();
    if (!name) {
      return { status: "error", message: "Pick a bourbon from the catalog." };
    }
    bourbonId = await createDraftProduct(supabase, auth.user.id, "bourbon", {
      name,
      brand: (formData.get("bourbon_extracted_brand") as string | null)?.trim() || null,
      specs: {},
    });
    const { data: row } = await supabase
      .from("products")
      .select("id, type, name, brand, specs")
      .eq("id", bourbonId)
      .single();
    bourbon = row ?? undefined;
  }

  if (!cigar || !bourbon) {
    return { status: "error", message: "Couldn't find both products for this pairing." };
  }

  const storagePathInput = (formData.get("photo_storage_path") as string | null)?.trim() || null;
  const photo = formData.get("photo");

  let storagePath: string;

  if (storagePathInput) {
    if (!storagePathInput.startsWith(`${auth.user.id}/`)) {
      return { status: "error", message: "Invalid photo reference." };
    }
    storagePath = storagePathInput;
  } else if (photo instanceof File && photo.size > 0) {
    if (photo.size > 4 * 1024 * 1024) {
      return { status: "error", message: "Photo too large (4 MB max)." };
    }
    const ext = guessExtension(photo.type) ?? "jpg";
    storagePath = `${auth.user.id}/${randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, photo, {
      contentType: photo.type || "image/jpeg",
      upsert: false,
    });
    if (uploadError) {
      return { status: "error", message: `Upload failed: ${uploadError.message}` };
    }
  } else {
    return { status: "error", message: "Add a photo of the pairing." };
  }

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
        recommend,
        chips: uniqueChips,
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
        recommend,
        chips: uniqueChips,
        note,
        eventId,
        pairingSessionId,
        photoImageId: bourbonImageId,
        releaseLabel: bourbonReleaseLabel,
        releaseLabelSource: bourbonReleaseLabel ? "member" : visionReleaseLabel ? "vision" : null,
        visionReleaseLabel,
      }),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't save the pairing.";
    return { status: "error", message };
  }

  if (recommend) {
    void syncPairingValidationCache(supabase, cigarId, bourbonId);
  }

  const params = new URLSearchParams({ just_saved_pairing: "1", pair_cigar: cigarId, pair_bourbon: bourbonId });
  redirect(`/?${params.toString()}`);
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
