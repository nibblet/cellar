"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateMakerBlurb } from "@/lib/makers/blurb";
import { loadMakerBySlug } from "@/lib/makers/load";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type MakerAdminState = {
  status: "idle" | "ok" | "error";
  message?: string;
};

async function requireAdminUserId(): Promise<
  { userId: string; error: null } | { userId: null; error: string }
> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { userId: null, error: "Not signed in." };

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profile?.role !== "admin") return { userId: null, error: "Not authorized." };
  return { userId: auth.user.id, error: null };
}

export async function updateMakerBlurb(
  _prev: MakerAdminState,
  formData: FormData,
): Promise<MakerAdminState> {
  const slug = String(formData.get("slug") ?? "").trim();
  const blurb = String(formData.get("blurb") ?? "").trim();
  if (!slug) return { status: "error", message: "Missing maker slug." };
  if (!blurb) return { status: "error", message: "Blurb cannot be empty." };

  const auth = await requireAdminUserId();
  if (!auth.userId) return { status: "error", message: auth.error ?? "Not authorized." };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("makers")
    .update({
      blurb,
      blurb_source: "manual",
      updated_by: auth.userId,
    })
    .eq("slug", slug);

  if (error) return { status: "error", message: error.message };

  revalidatePath(`/makers/${slug}`);
  return { status: "ok", message: "Saved." };
}

export async function regenerateMakerBlurb(
  _prev: MakerAdminState,
  formData: FormData,
): Promise<MakerAdminState> {
  const slug = String(formData.get("slug") ?? "").trim();
  if (!slug) return { status: "error", message: "Missing maker slug." };

  const auth = await requireAdminUserId();
  if (!auth.userId) return { status: "error", message: auth.error ?? "Not authorized." };

  const supabase = await createSupabaseServerClient();
  const maker = await loadMakerBySlug(supabase, slug);
  if (!maker) return { status: "error", message: "Maker not found." };
  if (maker.blurb_source === "manual") {
    return { status: "error", message: "Manual edits cannot be regenerated." };
  }

  let blurb: string;
  try {
    blurb = await generateMakerBlurb(maker.name, maker.type, supabase, auth.userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Regeneration failed.";
    return { status: "error", message };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("makers")
    .update({
      blurb,
      blurb_source: "ai",
      updated_by: auth.userId,
    })
    .eq("slug", slug);

  if (error) return { status: "error", message: error.message };

  revalidatePath(`/makers/${slug}`);
  return { status: "ok", message: "Regenerated." };
}
