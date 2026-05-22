"use server";

import { redirect } from "next/navigation";
import { markTried } from "@/lib/cellar/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveTasting } from "@/lib/tasting/save";
import type { ProductType } from "@/lib/wheel";

type State = { status: "idle" | "error"; message?: string };

export async function submitRecommend(_prev: State, formData: FormData): Promise<State> {
  const productId = String(formData.get("product_id") ?? "");
  const recommendRaw = String(formData.get("recommend") ?? "");
  if (!productId || (recommendRaw !== "yes" && recommendRaw !== "no")) {
    return { status: "error", message: "Missing product or recommendation." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: "error", message: "You're not signed in." };

  // Verify the product exists and grab its type for the wheel mapper.
  const { data: product } = await supabase
    .from("products")
    .select("id, type")
    .eq("id", productId)
    .maybeSingle();
  if (!product) return { status: "error", message: "That product no longer exists." };

  const chips = formData
    .getAll("chips")
    .map((c) => String(c).trim())
    .filter(Boolean);
  const note = (formData.get("note") as string | null)?.trim() || null;
  const eventId = (formData.get("event_id") as string | null)?.trim() || null;

  try {
    await saveTasting({
      supabase,
      userId: auth.user.id,
      productId: product.id,
      productType: product.type as ProductType,
      recommend: recommendRaw === "yes",
      chips,
      note,
      eventId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't save your tasting.";
    return { status: "error", message };
  }

  // Tasting recorded → member has tried this product. Fire-and-forget; a
  // failure here should never block the redirect.
  void markTried(auth.user.id, product.id, supabase);

  redirect(`/products/${product.id}?just_saved=1`);
}
