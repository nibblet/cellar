import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CellarInsightCard, TryNext } from "@/components/cellar";
import { AppShell } from "@/components/layout/app-shell";
import { CellarSection } from "@/components/members/sections";
import { Divider } from "@/components/primitives";
import { ensureCellarInsight } from "@/lib/cellar/insight";
import { formatMemberName, type MemberNameFields } from "@/lib/identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureTasteRecommendations } from "@/lib/taste";

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
    <AppShell>
      <header className="mb-5">
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">
          {formatMemberName(profile as MemberNameFields)}
        </p>
        <h1 className="text-3xl mt-1">Your cellar</h1>
      </header>

      <Suspense fallback={null}>
        <CellarInsightSection memberId={auth.user.id} />
      </Suspense>

      <Suspense fallback={null}>
        <TryNextSection memberId={auth.user.id} />
      </Suspense>

      <Divider label="The shelf" />

      <CellarSection
        memberId={auth.user.id}
        memberFirstName={profile.name_first}
        isOwnProfile={true}
      />
    </AppShell>
  );
}

async function CellarInsightSection({ memberId }: { memberId: string }) {
  const supabase = await createSupabaseServerClient();
  const insight = await ensureCellarInsight(supabase, memberId);
  if (!insight) return null;
  return <CellarInsightCard insight={insight} />;
}

async function TryNextSection({ memberId }: { memberId: string }) {
  const supabase = await createSupabaseServerClient();
  const recommendations = await ensureTasteRecommendations(supabase, memberId);
  if (recommendations.cigars.length === 0 && recommendations.bourbons.length === 0) return null;
  return (
    <>
      <Divider label="Try next" />
      <TryNext cigars={recommendations.cigars} bourbons={recommendations.bourbons} />
    </>
  );
}
