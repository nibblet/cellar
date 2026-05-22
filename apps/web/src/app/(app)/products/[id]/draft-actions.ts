"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Flip a draft product to confirmed. Any signed-in member can confirm —
 * the catalog is shared and we'd rather a wrong-but-confirmed entry get
 * corrected by edit than have drafts pile up unconfirmed forever.
 */
export async function confirmDraftProduct(
  productId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("products")
    .update({ status: "confirmed" })
    .eq("id", productId)
    .eq("status", "draft"); // no-op if someone else just confirmed

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/products/${productId}`);
  return { ok: true };
}
