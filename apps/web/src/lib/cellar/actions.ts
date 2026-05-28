"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CellarPatch, CellarRow } from "./types";
import { applyPatch, isZeroRow, ZERO_ROW } from "./types";

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
    .select("have, want, tried, loved")
    .eq("member_id", memberId)
    .eq("product_id", productId)
    .maybeSingle();

  const current: CellarRow = existing
    ? {
        have: Boolean((existing as CellarRow).have),
        want: Boolean((existing as CellarRow).want),
        tried: Boolean((existing as CellarRow).tried),
        loved: Boolean((existing as CellarRow).loved),
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
    await supabase
      .from("member_saves")
      .upsert(
        { member_id: memberId, product_id: productId, ...next },
        { onConflict: "member_id,product_id" },
      );
  }

  revalidatePath(`/products/${productId}`);
  revalidatePath(`/members/${memberId}`);
  revalidatePath("/");
}

/**
 * Toggle the caller's private `loved` signal for one product.
 * Loving implies tried (enforced in applyPatch). Thin wrapper over
 * setCellarState so the love affordance has a single-purpose call site.
 */
export async function setLoved(productId: string, loved: boolean): Promise<void> {
  await setCellarState(productId, { loved });
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

  if (existing && (existing as CellarRow).tried) return; // already set

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
