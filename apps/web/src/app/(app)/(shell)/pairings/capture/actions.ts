"use server";

import { randomUUID } from "node:crypto";
import { identifyPairFromImage } from "@/lib/identify";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { IdentifiedHalfPayload, IdentifyPairingState } from "./types";

const BUCKET = "product-photos";

export async function identifyPairingPhoto(
  _prev: IdentifyPairingState,
  formData: FormData,
): Promise<IdentifyPairingState> {
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return { status: "error", message: "Add a photo of the pairing." };
  }
  if (photo.size > 4 * 1024 * 1024) {
    return { status: "error", message: "Photo too large (4 MB max)." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return { status: "error", message: "You're not signed in." };
  }

  const ext = guessExtension(photo.type) ?? "jpg";
  const storagePath = `${auth.user.id}/${randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, photo, {
    contentType: photo.type || "image/jpeg",
    upsert: false,
  });
  if (uploadError) {
    return { status: "error", message: `Upload failed: ${uploadError.message}` };
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 300);

  if (signedError || !signed) {
    return { status: "error", message: `Could not sign URL: ${signedError?.message}` };
  }

  try {
    const result = await identifyPairFromImage({
      supabase,
      userId: auth.user.id,
      imageUrl: signed.signedUrl,
    });

    return {
      status: "identified",
      storagePath,
      cigar: toPayload(result.cigar),
      bourbon: toPayload(result.bourbon),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't read that photo.";
    return { status: "error", message };
  }
}

function toPayload(
  half: Awaited<ReturnType<typeof identifyPairFromImage>>["cigar"],
): IdentifiedHalfPayload {
  return {
    productId: half.productId,
    matched: half.matched,
    confidence: half.confidence,
    displayName: half.displayName,
    displayBrand: half.displayBrand,
    releaseLabel: half.releaseLabel,
    extractedName: half.extracted.name,
    extractedBrand: half.extracted.brand,
  };
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
