"use server";

import { redirect } from "next/navigation";
import { markTried, setCellarState } from "@/lib/cellar/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  type BourbonSessionPhases,
  type CigarSessionPhases,
  mergeBourbonSession,
  mergeCigarSession,
} from "@/lib/tasting/merge-session";
import { saveTasting } from "@/lib/tasting/save";
import type { ProductType } from "@/lib/wheel";

type State = { status: "idle" | "error"; message?: string };

function chipsFromForm(formData: FormData, name: string): string[] {
  return formData
    .getAll(name)
    .map((c) => String(c).trim())
    .filter(Boolean);
}

function noteFromForm(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function parseCigarPhases(formData: FormData): CigarSessionPhases {
  return {
    first: {
      chips: chipsFromForm(formData, "first_chips"),
      note: noteFromForm(formData, "first_note"),
    },
    second: {
      chips: chipsFromForm(formData, "second_chips"),
      note: noteFromForm(formData, "second_note"),
    },
    final: {
      chips: chipsFromForm(formData, "final_chips"),
      note: noteFromForm(formData, "final_note"),
    },
  };
}

function parseBourbonPhases(formData: FormData): BourbonSessionPhases {
  return {
    nose: {
      chips: chipsFromForm(formData, "nose_chips"),
      note: noteFromForm(formData, "nose_note"),
    },
    palate: {
      chips: chipsFromForm(formData, "palate_chips"),
      note: noteFromForm(formData, "palate_note"),
    },
    finish: {
      chips: chipsFromForm(formData, "finish_chips"),
      note: noteFromForm(formData, "finish_note"),
    },
  };
}

export async function submitSession(_prev: State, formData: FormData): Promise<State> {
  const productId = String(formData.get("product_id") ?? "");
  const recommendRaw = String(formData.get("recommend") ?? "");
  if (!productId || (recommendRaw !== "yes" && recommendRaw !== "no")) {
    return { status: "error", message: "Missing product or recommendation." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: "error", message: "You're not signed in." };

  const { data: product } = await supabase
    .from("products")
    .select("id, type")
    .eq("id", productId)
    .maybeSingle();
  if (!product) return { status: "error", message: "That product no longer exists." };

  const productType = product.type as ProductType;
  const merged =
    productType === "cigar"
      ? mergeCigarSession(parseCigarPhases(formData))
      : mergeBourbonSession(parseBourbonPhases(formData));

  const eventId = (formData.get("event_id") as string | null)?.trim() || null;
  const addToCellar = formData.get("add_to_cellar") === "yes";

  try {
    await saveTasting({
      supabase,
      userId: auth.user.id,
      productId: product.id,
      productType,
      recommend: recommendRaw === "yes",
      chips: merged.chips,
      note: merged.note,
      eventId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't save your tasting.";
    return { status: "error", message };
  }

  void markTried(auth.user.id, product.id, supabase);

  if (addToCellar) {
    try {
      await setCellarState(product.id, { have: true });
    } catch {
      // Cellar update failure should not block the redirect.
    }
  }

  redirect(`/products/${product.id}?just_saved=1`);
}
