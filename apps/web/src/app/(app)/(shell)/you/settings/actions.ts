"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DisplayNameFormState = {
  ok: boolean;
  message: string | null;
};

export async function updateDisplayName(
  _prev: DisplayNameFormState,
  formData: FormData,
): Promise<DisplayNameFormState> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Not signed in." };

  const firstRaw = formData.get("name_first");
  const initialRaw = formData.get("name_last_initial");

  const nameFirst = typeof firstRaw === "string" ? firstRaw.trim() : "";
  const initialRawStr = typeof initialRaw === "string" ? initialRaw.trim() : "";
  const nameLastInitial = initialRawStr.charAt(0).toUpperCase();

  if (nameFirst.length === 0 || nameFirst.length > 40) {
    return { ok: false, message: "First name must be 1-40 characters." };
  }
  if (initialRawStr.length > 0 && !/^[A-Za-z]$/.test(initialRawStr.charAt(0))) {
    return { ok: false, message: "Last initial must be a single letter." };
  }

  const { error } = await supabase
    .from("users")
    .update({ name_first: nameFirst, name_last_initial: nameLastInitial })
    .eq("id", auth.user.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/you");
  revalidatePath("/you/settings");
  revalidatePath("/members");
  return { ok: true, message: "Saved." };
}

export type AvatarFormState = {
  ok: boolean;
  message: string | null;
};

export async function uploadAvatar(
  _prev: AvatarFormState,
  formData: FormData,
): Promise<AvatarFormState> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Not signed in." };

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Please choose an image." };
  }
  if (file.size > 4 * 1024 * 1024) {
    return { ok: false, message: "Image must be under 4 MB." };
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${auth.user.id}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) return { ok: false, message: uploadError.message };

  const { error: dbError } = await supabase
    .from("users")
    .update({ avatar_url: path })
    .eq("id", auth.user.id);

  if (dbError) return { ok: false, message: dbError.message };

  revalidatePath("/you");
  revalidatePath("/you/settings");
  return { ok: true, message: "Avatar updated." };
}
