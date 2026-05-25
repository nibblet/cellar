import { redirect } from "next/navigation";
import { BottomNav } from "@/components/nav/bottom-nav";
import { needsOnboarding } from "@/lib/onboarding/load";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("onboarding_completed_at")
    .eq("id", auth.user?.id ?? "")
    .maybeSingle();

  if (profile && needsOnboarding(profile)) {
    redirect("/welcome");
  }

  return (
    <>
      {children}
      <BottomNav />
    </>
  );
}
