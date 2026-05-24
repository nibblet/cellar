import { redirect } from "next/navigation";
import { CellarSection } from "@/components/members/sections";
import { Divider } from "@/components/primitives";
import { formatMemberName, type MemberNameFields } from "@/lib/identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function YouCellarPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name_first, name_last_initial")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile) redirect("/login");

  return (
    <main className="mx-auto max-w-md px-5 py-6 pb-24 flex-1">
      <header className="mb-5">
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">
          {formatMemberName(profile as MemberNameFields)}
        </p>
        <h1 className="text-3xl mt-1">Your cellar</h1>
      </header>

      <Divider label="The shelf" />

      <CellarSection
        memberId={auth.user.id}
        memberFirstName={profile.name_first}
        isOwnProfile={true}
      />
    </main>
  );
}
