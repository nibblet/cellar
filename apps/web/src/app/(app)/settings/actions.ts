"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  BOURBON_PROOF_BANDS,
  BOURBON_STYLES,
  CIGAR_STRENGTHS,
  CIGAR_WRAPPER_BUCKETS,
} from "@/lib/preferences/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type PreferencesFormState = {
  ok: boolean;
  message: string | null;
};

export async function savePreferences(
  _prev: PreferencesFormState,
  formData: FormData,
): Promise<PreferencesFormState> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Not signed in." };

  // Whitelist each axis against its vocabulary so a tampered form can't
  // store arbitrary strings.
  const cigar_strengths = formData
    .getAll("cigar_strengths")
    .filter(
      (v): v is string =>
        typeof v === "string" && (CIGAR_STRENGTHS as readonly string[]).includes(v),
    );
  const cigar_wrappers = formData
    .getAll("cigar_wrappers")
    .filter(
      (v): v is string =>
        typeof v === "string" && (CIGAR_WRAPPER_BUCKETS as readonly string[]).includes(v),
    );
  const bourbon_styles = formData
    .getAll("bourbon_styles")
    .filter(
      (v): v is string =>
        typeof v === "string" && (BOURBON_STYLES as readonly string[]).includes(v),
    );
  const bourbon_proof_bands = formData
    .getAll("bourbon_proof_bands")
    .filter(
      (v): v is string =>
        typeof v === "string" && (BOURBON_PROOF_BANDS as readonly string[]).includes(v),
    );

  const { error } = await supabase.from("member_preferences").upsert(
    {
      user_id: auth.user.id,
      cigar_strengths,
      cigar_wrappers,
      bourbon_styles,
      bourbon_proof_bands,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) return { ok: false, message: error.message };

  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true, message: "Saved." };
}
