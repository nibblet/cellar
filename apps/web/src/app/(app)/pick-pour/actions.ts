"use server";

import { redirect } from "next/navigation";
import { loadCellarSnapshot } from "@/lib/cellar/load";
import { todayKey } from "@/lib/daily-pour/select";
import { isHaveShelfPair, loadPickPourCandidates } from "@/lib/pick-pour/load";
import { selectPickPour } from "@/lib/pick-pour/select";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type State = { status: "idle" | "error"; message?: string };

async function pickPourErrorMessage(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  memberId: string,
): Promise<string> {
  const cellar = await loadCellarSnapshot(supabase, memberId);
  if (cellar.have.size === 0) {
    return "Your Have shelf is empty — mark what you're pouring tonight first.";
  }

  const { data: rows } = await supabase
    .from("products")
    .select("id, type")
    .in("id", [...cellar.have]);

  let cigars = 0;
  let bourbons = 0;
  for (const row of (rows as Array<{ type: string }> | null) ?? []) {
    if (row.type === "cigar") cigars++;
    else if (row.type === "bourbon") bourbons++;
  }

  if (cigars === 0 || bourbons === 0) {
    return "Need at least one cigar and one bourbon on your Have shelf to pick a pairing.";
  }

  return "Couldn't score a pairing from your Have shelf yet — check that those products have flavor profiles.";
}

export async function pickMyPour(_prev: State, formData: FormData): Promise<State> {
  const rollRaw = formData.get("roll_index");
  const rollIndex = rollRaw != null ? Number.parseInt(String(rollRaw), 10) : 0;
  if (!Number.isFinite(rollIndex) || rollIndex < 0) {
    return { status: "error", message: "Invalid roll." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: "error", message: "You're not signed in." };

  const cellar = await loadCellarSnapshot(supabase, auth.user.id);
  const candidates = await loadPickPourCandidates(supabase, auth.user.id);
  const pick = selectPickPour({ memberId: auth.user.id, date: todayKey(), rollIndex }, candidates);

  if (!pick || !isHaveShelfPair(pick, cellar.have)) {
    return { status: "error", message: await pickPourErrorMessage(supabase, auth.user.id) };
  }

  redirect(`/pairings/${pick.cigar_id}/${pick.bourbon_id}`);
}
