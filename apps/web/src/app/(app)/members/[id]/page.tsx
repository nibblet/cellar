import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { MemberBadges } from "@/components/members";
import { CellarSection, TastingsSection } from "@/components/members/sections";
import { badgesForMember, loadMemberBadges } from "@/lib/badges/load";
import { formatMemberName, type MemberNameFields } from "@/lib/identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ tab?: string }>;

type ProfileTab = "tastings" | "cellar";

function parseProfileTab(raw: string | undefined): ProfileTab {
  return raw === "cellar" ? "cellar" : "tastings";
}

export default async function MemberProfilePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { tab: tabRaw } = await searchParams;
  const tab = parseProfileTab(tabRaw);

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();

  if (auth.user?.id === id) {
    if (tabRaw === "cellar") redirect("/you/cellar");
    if (tabRaw === "tastings") redirect("/you/tastings");
    redirect("/you");
  }

  const [memberResult, badgeMap] = await Promise.all([
    supabase
      .from("users")
      .select("id, name_first, name_last_initial, joined_at")
      .eq("id", id)
      .maybeSingle(),
    loadMemberBadges(supabase),
  ]);

  if (!memberResult.data) notFound();

  const member = memberResult.data;
  const profile = member as MemberNameFields & { id: string; joined_at: string };
  const viewerId = auth.user?.id ?? null;
  const isOwnProfile = viewerId === id;
  const badges = badgesForMember(badgeMap, id);

  return (
    <AppShell>
      <header className="mb-5">
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">Member</p>
        <h1 className="text-3xl mt-1">{formatMemberName(profile)}</h1>
        {badges.length > 0 ? (
          <MemberBadges badges={badges} variant="profile" className="mt-3" />
        ) : null}
      </header>

      <div className="flex items-center gap-2 mb-5 border-b border-border">
        <TabLink label="Tastings" href={`/members/${id}`} active={tab === "tastings"} />
        <TabLink label="Cellar" href={`/members/${id}?tab=cellar`} active={tab === "cellar"} />
      </div>

      {tab === "cellar" ? (
        <CellarSection
          memberId={id}
          memberFirstName={member.name_first}
          isOwnProfile={isOwnProfile}
        />
      ) : (
        <TastingsSection memberId={id} displayName={formatMemberName(profile)} />
      )}
    </AppShell>
  );
}

function TabLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <a
      href={href}
      className={`pb-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
        active
          ? "border-accent text-foreground"
          : "border-transparent text-foreground-muted hover:text-foreground"
      }`}
    >
      {label}
    </a>
  );
}
