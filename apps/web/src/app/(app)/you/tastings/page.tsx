import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { TastingsSection } from "@/components/members/sections";
import { Divider } from "@/components/primitives";
import { formatMemberName, type MemberNameFields } from "@/lib/identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function YouTastingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name_first, name_last_initial")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile) redirect("/login");

  const displayName = formatMemberName(profile as MemberNameFields);

  return (
    <AppShell>
      <header className="mb-5">
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">{displayName}</p>
        <h1 className="text-3xl mt-1">Your tastings</h1>
      </header>

      <Divider label="The archive" />

      <TastingsSection memberId={auth.user.id} displayName={displayName} />
    </AppShell>
  );
}
