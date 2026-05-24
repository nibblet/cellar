import { notFound } from "next/navigation";
import { CellarTab } from "@/components/cellar";
import { TastingCard } from "@/components/feed";
import { MemberBadges } from "@/components/members";
import { Card, Divider } from "@/components/primitives";
import { badgesForMember, loadMemberBadges } from "@/lib/badges/load";
import { loadCellarProducts } from "@/lib/cellar/load";
import { loadFeed, signImagePaths } from "@/lib/feed/queries";
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

  const [memberResult, authResult, badgeMap] = await Promise.all([
    supabase
      .from("users")
      .select("id, name_first, name_last_initial, joined_at")
      .eq("id", id)
      .maybeSingle(),
    supabase.auth.getUser(),
    loadMemberBadges(supabase),
  ]);

  if (!memberResult.data) notFound();

  const member = memberResult.data;
  const profile = member as MemberNameFields & { id: string; joined_at: string };
  const viewerId = authResult.data.user?.id ?? null;
  const isOwnProfile = viewerId === id;
  const badges = badgesForMember(badgeMap, id);

  return (
    <main className="mx-auto max-w-md px-5 py-6 pb-24 flex-1">
      <header className="mb-5">
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">Member</p>
        <h1 className="text-3xl mt-1">{formatMemberName(profile)}</h1>
        {badges.length > 0 ? (
          <MemberBadges badges={badges} variant="profile" className="mt-3" />
        ) : null}
      </header>

      {/* Tab switcher */}
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
    </main>
  );
}

async function TastingsSection({
  memberId,
  displayName,
}: {
  memberId: string;
  displayName: string;
}) {
  const supabase = await createSupabaseServerClient();
  const entries = await loadFeed(supabase, { userId: memberId, limit: 100 });
  const signed = await signImagePaths(
    supabase,
    entries.map((e) => e.hero_image_path),
  );

  const total = entries.length;
  const recommended = entries.filter((e) => e.recommend).length;

  return (
    <>
      <p className="text-sm text-foreground-muted mb-4">
        {total} tasting{total === 1 ? "" : "s"}
        {recommended > 0 ? ` · ${recommended} recommended` : ""}
      </p>

      <Divider label="Their archive" />

      {entries.length === 0 ? (
        <Card>
          <p className="text-sm text-foreground-subtle">
            {displayName} hasn't logged a tasting yet.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => (
            <TastingCard
              key={entry.tasting_id}
              entry={entry}
              signedHero={
                entry.hero_image_path ? (signed.get(entry.hero_image_path) ?? null) : null
              }
            />
          ))}
        </div>
      )}
    </>
  );
}

async function CellarSection({
  memberId,
  memberFirstName,
  isOwnProfile,
}: {
  memberId: string;
  memberFirstName: string;
  isOwnProfile: boolean;
}) {
  const supabase = await createSupabaseServerClient();
  const [have, want, tried] = await Promise.all([
    loadCellarProducts(supabase, memberId, "have"),
    loadCellarProducts(supabase, memberId, "want"),
    loadCellarProducts(supabase, memberId, "tried"),
  ]);

  return (
    <CellarTab
      have={have}
      want={want}
      tried={tried}
      isOwnProfile={isOwnProfile}
      memberFirstName={memberFirstName}
    />
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
