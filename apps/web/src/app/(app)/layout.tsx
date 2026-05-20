import { redirect } from "next/navigation";
import { BottomNav } from "@/components/nav/bottom-nav";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/login");
  }

  // Confirm the auth user has a public.users profile. If not (mid-onboarding
  // or a malformed signup), bounce them to accept-invite to complete it.
  const { data: profile } = await supabase
    .from("users")
    .select("id, name_first, name_last_initial")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/login");
  }

  return (
    <>
      {children}
      <BottomNav />
    </>
  );
}
