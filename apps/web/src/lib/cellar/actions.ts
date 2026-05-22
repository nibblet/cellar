"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ZERO_ROW, applyPatch, isZeroRow } from "./types";
import type { CellarPatch, CellarRow } from "./types";

/**
 * Upsert the caller's cellar state for one product. Enforces:
 *   - have/want mutex
 *   - have implies tried
 *   - zero-state rows are deleted, not stored
 *
 * Revalidates the product detail page and the member's profile page so
 * server-rendered Cellar tabs + toggle state stay fresh.
 */
export async function setCellarState(productId: string, patch: CellarPatch): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");

  const memberId = auth.user.id;

  const { data: existing } = await supabase
    .from("member_saves")
    .select("have, want, tried")
    .eq("member_id", memberId)
    .eq("product_id", productId)
    .maybeSingle();

  const current: CellarRow = existing
    ? {
        have: Boolean((existing as CellarRow).have),
        want: Boolean((existing as CellarRow).want),
        tried: Boolean((existing as CellarRow).tried),
      }
    : ZERO_ROW;

  const next = applyPatch(current, patch);

  if (isZeroRow(next)) {
    await supabase
      .from("member_saves")
      .delete()
      .eq("member_id", memberId)
      .eq("product_id", productId);
  } else {
    await supabase.from("member_saves").upsert(
      { member_id: memberId, product_id: productId, ...next },
      { onConflict: "member_id,product_id" },
    );
  }

  revalidatePath(`/products/${productId}`);
  revalidatePath(`/members/${memberId}`);
  revalidatePath("/");
}

/**
 * Mark tried=true for a product without touching have/want.
 * Called automatically after a successful Recommend-to-NCCC tasting.
 */
export async function markTried(
  memberId: string,
  productId: string,
  supabaseClient: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<void> {
  const { data: existing } = await supabaseClient
    .from("member_saves")
    .select("have, want, tried")
    .eq("member_id", memberId)
    .eq("product_id", productId)
    .maybeSingle();

  if (existing && Boolean((existing as CellarRow).tried)) return; // already set

  await supabaseClient.from("member_saves").upsert(
    {
      member_id: memberId,
      product_id: productId,
      have: Boolean((existing as CellarRow | null)?.have),
      want: Boolean((existing as CellarRow | null)?.want),
      tried: true,
    },
    { onConflict: "member_id,product_id" },
  );
}
