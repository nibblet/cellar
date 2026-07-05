import { redirect } from "next/navigation";
import { signOut } from "@/app/(app)/(shell)/settings/actions";
import { MemberSinceEditor } from "@/app/(app)/(shell)/settings/member-since-editor";
import { PreferencesForm } from "@/app/(app)/(shell)/settings/preferences-form";
import { AppShell } from "@/components/layout/app-shell";
import { MemberBadges } from "@/components/members";
import { Button, Card, Divider } from "@/components/primitives";
import { ThemeToggle } from "@/components/theme";
import type { BadgeComputeInput } from "@/lib/badges/compute";
import { badgesForMember, loadMemberBadges } from "@/lib/badges/load";
import { nextBadgeForMember } from "@/lib/badges/next";
import { formatMemberInitials, formatMemberName, type MemberNameFields } from "@/lib/identity";
import { loadMemberPreferences } from "@/lib/preferences/load";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AvatarUploader } from "../you/settings/avatar-uploader";
import { DisplayNameForm } from "../you/settings/display-name-form";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const me = auth.user.id;

  const [{ data: profile }, badgeMap, badgeInputs] = await Promise.all([
    supabase
      .from("users")
      .select("id, name_first, name_last_initial, role, joined_at, club_joined_at, avatar_url")
      .eq("id", me)
      .maybeSingle(),
    loadMemberBadges(supabase),
    buildBadgeInputs(supabase),
  ]);

  if (!profile) redirect("/login");

  const displayName = formatMemberName(profile as MemberNameFields);
  const initials = formatMemberInitials(profile as MemberNameFields);
  const initial = profile.name_first?.charAt(0).toUpperCase() ?? "?";
  const preferences = await loadMemberPreferences(supabase, auth.user.id);
  const badges = badgesForMember(badgeMap, me);
  const nextBadge = nextBadgeForMember(badgeInputs, me);

  const joinedSource: string | null = profile.club_joined_at ?? profile.joined_at ?? null;
  const joinedDate = joinedSource ? new Date(joinedSource) : null;
  const clubDate: Date | null = profile.club_joined_at ? new Date(profile.club_joined_at) : null;
  const currentMonth = clubDate ? clubDate.getUTCMonth() + 1 : null;
  const currentYear = clubDate ? clubDate.getUTCFullYear() : null;
  const joinedLabel = joinedDate
    ? `Member since ${joinedDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })}`
    : null;

  let avatarSignedUrl: string | null = null;
  if (profile.avatar_url) {
    const { data: signed } = await supabase.storage
      .from("avatars")
      .createSignedUrl(profile.avatar_url, 60 * 60);
    avatarSignedUrl = signed?.signedUrl ?? null;
  }

  return (
    <AppShell>
      <header className="mb-6 flex flex-col items-center text-center">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-accent-tint to-accent/30 border border-accent/40 flex items-center justify-center overflow-hidden mb-3">
          {avatarSignedUrl ? (
            // biome-ignore lint/performance/noImgElement: signed URL
            <img src={avatarSignedUrl} alt={initials} className="w-full h-full object-cover" />
          ) : (
            <span className="font-display text-3xl tracking-tight text-foreground">{initials}</span>
          )}
        </div>
        <h1 className="text-3xl">{displayName}</h1>
        {joinedDate ? (
          <p className="text-sm text-foreground-muted mt-1">
            Member since{" "}
            {joinedDate.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })}
          </p>
        ) : null}
        {badges.length > 0 || nextBadge ? (
          <div className="mt-5 flex items-start gap-4 justify-center flex-wrap">
            {badges.length > 0 ? <MemberBadges badges={badges} variant="hero" /> : null}
            {nextBadge ? (
              <span className="inline-flex flex-col items-center gap-1 w-16 opacity-50">
                <span className="inline-flex items-center justify-center rounded-full border border-dashed border-border bg-surface text-foreground-subtle font-medium tabular-nums min-w-[1.75rem] h-7 px-1.5 text-[11px] tracking-wide">
                  {nextBadge.badge.mark}
                </span>
                <span className="text-[9px] uppercase tracking-widest text-foreground-subtle text-center leading-tight">
                  {nextBadge.badge.label}
                  <br />
                  {nextBadge.gap}
                </span>
              </span>
            ) : null}
          </div>
        ) : null}
      </header>

      <Divider label="Account" />
      <Card className="mb-3">
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="large" className="w-full">
            Sign out
          </Button>
        </form>
      </Card>

      <Divider label="Identity" />
      <Card id="hero" className="mb-3 scroll-mt-28">
        <AvatarUploader currentSignedUrl={avatarSignedUrl} initial={initial} />
      </Card>
      <Card id="name" className="mb-3 scroll-mt-28">
        <DisplayNameForm
          initialFirst={profile.name_first ?? ""}
          initialInitial={profile.name_last_initial ?? ""}
        />
      </Card>
      <Card className="mb-3">
        <MemberSinceEditor
          currentLabel={joinedLabel}
          currentMonth={currentMonth}
          currentYear={currentYear}
        />
      </Card>

      <Divider label="Appearance" />
      <section id="appearance" className="mb-3 scroll-mt-28">
        <ThemeToggle />
      </section>

      {preferences ? (
        <section id="preferences" className="scroll-mt-28">
          <Divider label="Taste preferences" />
          <Card className="mb-3">
            <PreferencesForm initial={preferences} />
          </Card>
        </section>
      ) : null}
    </AppShell>
  );
}

async function buildBadgeInputs(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<BadgeComputeInput> {
  const [membersResult, tastingsResult, eventsResult, winstonResult] = await Promise.all([
    supabase.from("users").select("id, joined_at"),
    supabase
      .from("tastings")
      .select("user_id, product_id, recommend, created_at, event_id, product:products(type)"),
    supabase.from("events").select("id, date, host_user_id"),
    supabase
      .from("pairings_cache")
      .select("cigar_id, bourbon_id")
      .not("rationale_text", "is", null),
  ]);

  type TastingQueryRow = {
    user_id: string;
    product_id: string;
    recommend: boolean;
    created_at: string;
    event_id: string | null;
    product: { type: "cigar" | "bourbon" } | null;
  };

  const tastings = ((tastingsResult.data as TastingQueryRow[] | null) ?? []).flatMap((row) => {
    const type = row.product?.type;
    if (type !== "cigar" && type !== "bourbon") return [];
    return [
      {
        user_id: row.user_id,
        product_id: row.product_id,
        product_type: type,
        recommend: row.recommend,
        created_at: row.created_at,
        event_id: row.event_id,
      },
    ];
  });

  return {
    members: (membersResult.data ?? []) as BadgeComputeInput["members"],
    tastings,
    events: (eventsResult.data ?? []) as BadgeComputeInput["events"],
    winstonPairs: (winstonResult.data ?? []) as BadgeComputeInput["winstonPairs"],
  };
}
