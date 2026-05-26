"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { identifyAndPersist } from "@/lib/identify";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProductType } from "@/lib/wheel";

type State = { status: "idle" | "error"; message?: string };

const BUCKET = "product-photos";

export async function submitCapture(_prev: State, formData: FormData): Promise<State> {
  const type = String(formData.get("type") ?? "") as ProductType;
  if (type !== "cigar" && type !== "bourbon") {
    return { status: "error", message: "Pick cigar or bourbon first." };
  }

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return { status: "error", message: "Add a photo before submitting." };
  }
  if (photo.size > 4 * 1024 * 1024) {
    return { status: "error", message: "Photo too large (4 MB max)." };
  }

  const eventId = (formData.get("event_id") as string | null)?.trim() || null;

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

  // The bucket is private — generate a short-lived signed URL for OpenAI to fetch.
  const { data: signed, error: signedError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 300); // 5 minutes is plenty

  if (signedError || !signed) {
    return { status: "error", message: `Could not sign URL: ${signedError?.message}` };
  }

  let outcome: Awaited<ReturnType<typeof identifyAndPersist>>;
  try {
    outcome = await identifyAndPersist({
      supabase,
      userId: auth.user.id,
      imagePublicUrl: signed.signedUrl,
      storagePath,
      expectedType: type,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Identification failed.";
    return { status: "error", message };
  }

  const params = new URLSearchParams({ just_captured: "1" });
  if (outcome.matched) params.set("catalog_match", "1");
  if (eventId) params.set("event", eventId);
  if (outcome.releaseLabel) params.set("release_label", outcome.releaseLabel);
  if (outcome.releaseLabel) params.set("release_label_source", "vision");
  redirect(`/products/${outcome.productId}?${params.toString()}`);
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
