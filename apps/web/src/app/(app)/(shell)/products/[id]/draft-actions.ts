"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type State = { ok: boolean; error?: string };

/**
 * Flip a draft product to confirmed and send the member straight to the
 * tasting form. Catalog enrichment keeps running in the background on the
 * product page — we don't make them wait for web search here.
 */
export async function confirmDraftProduct(_prev: State, formData: FormData): Promise<State> {
  const productId = String(formData.get("product_id") ?? "");
  if (!productId) return { ok: false, error: "Missing product." };

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("products")
    .update({ status: "confirmed" })
    .eq("id", productId)
    .eq("status", "draft");

  if (error) return { ok: false, error: error.message };

  const params = new URLSearchParams({ confirmed: "1", enriching: "1" });

  const eventId = (formData.get("event_id") as string | null)?.trim();
  if (eventId) params.set("event", eventId);

  const releaseLabel = (formData.get("release_label") as string | null)?.trim();
  if (releaseLabel) {
    params.set("release_label", releaseLabel);
    params.set("release_label_source", "member");
  }

  const visionReleaseLabel = (formData.get("vision_release_label") as string | null)?.trim();
  if (visionReleaseLabel) {
    params.set("vision_release_label", visionReleaseLabel);
    if (!releaseLabel) params.set("release_label_source", "vision");
  }

  redirect(`/products/${productId}/recommend?${params.toString()}`);
}
