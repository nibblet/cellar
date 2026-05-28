"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requireAdminSupabase() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { supabase: null, error: "Not signed in." as const };

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profile?.role !== "admin") return { supabase: null, error: "Not authorized." as const };
  return { supabase, error: null };
}

export type SetCatalogIncludedState = {
  status: "idle" | "ok" | "error";
  message?: string;
};

/** Admin: hide a bourbon from the member-facing catalog, or promote it back. */
export async function setCatalogIncluded(
  _prev: SetCatalogIncludedState,
  formData: FormData,
): Promise<SetCatalogIncludedState> {
  const productId = String(formData.get("product_id") ?? "").trim();
  const includedRaw = String(formData.get("included") ?? "").trim();
  if (!productId) return { status: "error", message: "Missing product id." };
  if (includedRaw !== "true" && includedRaw !== "false") {
    return { status: "error", message: "Invalid included value." };
  }
  const included = includedRaw === "true";

  const { supabase, error: authError } = await requireAdminSupabase();
  if (!supabase) return { status: "error", message: authError };

  const { error: updateError } = await supabase
    .from("products")
    .update({ catalog_included: included })
    .eq("id", productId)
    .eq("type", "bourbon");

  if (updateError) return { status: "error", message: updateError.message };

  revalidatePath("/admin/catalog");
  revalidatePath("/");
  return { status: "ok" };
}
