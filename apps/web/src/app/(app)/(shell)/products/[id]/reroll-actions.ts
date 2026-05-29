"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type RerollState = { status: "idle" | "ok" | "error"; message?: string };

export async function rerollWinstonProse(
  _prev: RerollState,
  formData: FormData,
): Promise<RerollState> {
  const productId = String(formData.get("product_id") ?? "").trim();
  if (!productId) return { status: "error", message: "Missing product id." };

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: "error", message: "Not signed in." };

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profile?.role !== "admin") return { status: "error", message: "Not authorized." };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("products")
    .update({ winston_prose: null })
    .eq("id", productId);
  if (error) return { status: "error", message: error.message };

  revalidatePath(`/products/${productId}`);
  return { status: "ok", message: "Cleared — refresh to regenerate." };
}
