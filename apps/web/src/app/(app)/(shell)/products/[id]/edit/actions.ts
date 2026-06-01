"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProductType } from "@/lib/wheel";

export type EditProductState = {
  status: "idle" | "error";
  message?: string;
};

/**
 * RLS already restricts UPDATE on products to creator-or-admin. We also
 * gate by checking the row's status — confirmed catalog entries can only
 * be edited by admins to prevent any member from rewriting Wild Turkey.
 */
export async function updateProduct(
  _prev: EditProductState,
  formData: FormData,
): Promise<EditProductState> {
  const productId = String(formData.get("product_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const brand = String(formData.get("brand") ?? "").trim() || null;
  const type = String(formData.get("type") ?? "") as ProductType;

  if (!productId) return { status: "error", message: "Missing product id." };
  if (!name) return { status: "error", message: "Name can't be empty." };
  if (type !== "cigar" && type !== "bourbon") {
    return { status: "error", message: "Type must be cigar or bourbon." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: "error", message: "Not signed in." };

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  const { data: product } = await supabase
    .from("products")
    .select("status, created_by")
    .eq("id", productId)
    .maybeSingle();

  if (!product) return { status: "error", message: "Product not found." };

  const isAdmin = profile?.role === "admin";
  const isCreator = product.created_by === auth.user.id;

  if (product.status === "confirmed" && !isAdmin) {
    return {
      status: "error",
      message: "Only admins can edit confirmed catalog entries.",
    };
  }

  if (!isAdmin && !isCreator) {
    return {
      status: "error",
      message: "You can only edit drafts you created.",
    };
  }

  // Collect typed spec fields. We only let the user touch a small whitelisted
  // set; raw jsonb writes are reserved for the seed pass + AI ingest.
  const incomingSpecs: Record<string, string | number | null> = {};

  for (const field of [
    "wrapper_color",
    "country",
    "vitola",
    "strength",
    "distillery",
    "mash_bill",
    "age_label",
    "availability_rarity",
  ]) {
    const v = (formData.get(`specs.${field}`) as string | null)?.trim();
    if (v !== undefined) incomingSpecs[field] = v || null;
  }

  for (const field of ["proof", "tier", "price_usd", "price_tier"]) {
    const v = (formData.get(`specs.${field}`) as string | null)?.trim();
    if (v !== undefined) {
      if (!v) {
        incomingSpecs[field] = null;
      } else {
        const n = Number.parseFloat(v);
        incomingSpecs[field] = Number.isFinite(n) && n > 0 ? n : null;
      }
    }
  }

  // Read existing specs so we merge instead of clobbering.
  const { data: existing } = await supabase
    .from("products")
    .select("specs")
    .eq("id", productId)
    .maybeSingle();
  const mergedSpecs = {
    ...((existing?.specs as Record<string, unknown>) ?? {}),
    ...incomingSpecs,
  };

  const { error } = await supabase
    .from("products")
    .update({
      name,
      brand,
      type,
      specs: mergedSpecs,
      // Promote drafts to confirmed when an admin saves them.
      ...(isAdmin && product.status === "draft" ? { status: "confirmed" as const } : {}),
    })
    .eq("id", productId);

  if (error) return { status: "error", message: error.message };

  redirect(`/products/${productId}`);
}
