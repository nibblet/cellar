"use server";

import { redirect } from "next/navigation";
import { getOnboardingExitPath } from "@/lib/navigation/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OnboardingExit } from "./types";

export async function completeOnboarding(exit: OnboardingExit): Promise<never> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  await supabase
    .from("users")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", auth.user.id)
    .is("onboarding_completed_at", null);

  redirect(getOnboardingExitPath(exit));
}
