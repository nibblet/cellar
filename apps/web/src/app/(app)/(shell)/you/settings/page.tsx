import { signOut } from "@/app/(app)/(shell)/settings/actions";
import { MemberSinceEditor } from "@/app/(app)/(shell)/settings/member-since-editor";
import { PreferencesForm } from "@/app/(app)/(shell)/settings/preferences-form";
import { AppShell } from "@/components/layout/app-shell";
import { Button, Card, Divider } from "@/components/primitives";
import { ThemeToggle } from "@/components/theme";
import { formatMemberName, type MemberNameFields } from "@/lib/identity";
import { loadMemberPreferences } from "@/lib/preferences/load";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AvatarUploader } from "./avatar-uploader";
import { DisplayNameForm } from "./display-name-form";

export default async function YouSettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("name_first, name_last_initial, role, joined_at, club_joined_at, avatar_url")
    .eq("id", auth.user?.id ?? "")
    .maybeSingle();

  if (!profile || !auth.user) return null;

  const displayName = formatMemberName(profile as MemberNameFields);
  const initial = profile.name_first?.charAt(0).toUpperCase() ?? "?";
  const preferences = await loadMemberPreferences(supabase, auth.user.id);

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
      <header className="mb-6 text-center">
        <h1 className="text-3xl">Settings</h1>
        <p className="text-sm tracking-widest uppercase text-foreground-subtle mt-1">
          {displayName}
        </p>
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
      <Card className="mb-3">
        <AvatarUploader currentSignedUrl={avatarSignedUrl} initial={initial} />
      </Card>
      <Card className="mb-3">
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
      <ThemeToggle />

      {preferences ? (
        <section id="preferences">
          <Divider label="Taste preferences" />
          <Card className="mb-3">
            <PreferencesForm initial={preferences} />
          </Card>
        </section>
      ) : null}
    </AppShell>
  );
}
