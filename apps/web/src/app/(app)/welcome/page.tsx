import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { WelcomeFlow } from "@/components/onboarding/welcome-flow";
import { TONIGHT_PATH } from "@/lib/navigation/paths";
import { needsOnboarding } from "@/lib/onboarding/load";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function WelcomePage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("name_first, onboarding_completed_at")
    .eq("id", auth.user?.id ?? "")
    .maybeSingle();

  if (profile && !needsOnboarding(profile)) {
    redirect(TONIGHT_PATH);
  }

  const firstName = profile?.name_first ?? "friend";

  return (
    <AppShell auth>
      <WelcomeFlow firstName={firstName} />
    </AppShell>
  );
}
