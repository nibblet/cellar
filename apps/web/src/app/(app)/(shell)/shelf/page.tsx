import { redirect } from "next/navigation";
import { CellarStatStrip } from "@/components/cellar/home-v2-sections";
import { AppShell } from "@/components/layout/app-shell";
import { CellarSection } from "@/components/members/sections";
import { Divider } from "@/components/primitives";
import { loadCellarSnapshot } from "@/lib/cellar/load";
import { loadProductTypes, splitIdsByProductType } from "@/lib/products/split-by-type";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ShelfPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name_first, name_last_initial")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!profile) redirect("/login");

  const snapshot = await loadCellarSnapshot(supabase, auth.user.id);
  const haveTypes = await loadProductTypes(supabase, snapshot.have);
  const { bourbons, cigars } = splitIdsByProductType(haveTypes);

  return (
    <AppShell>
      <header className="mb-5">
        <h1 className="text-3xl">Your shelf</h1>
        <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-foreground-subtle">
          Have · Want · Tried
        </p>
      </header>

      <CellarStatStrip
        bottleCount={bourbons.length}
        cigarCount={cigars.length}
        huntingCount={snapshot.want.size}
      />

      <Divider label="The shelf" />

      <CellarSection
        memberId={auth.user.id}
        memberFirstName={profile.name_first}
        isOwnProfile={true}
      />
    </AppShell>
  );
}
