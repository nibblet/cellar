import Link from "next/link";
import { Button, Card, Divider } from "@/components/primitives";
import { ThemeToggle } from "@/components/theme";
import { formatMemberName, type MemberNameFields } from "@/lib/identity";
import { loadMemberPreferences } from "@/lib/preferences/load";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { MemberSinceEditor } from "./member-since-editor";
import { PreferencesForm } from "./preferences-form";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("name_first, name_last_initial, role, joined_at, club_joined_at")
    .eq("id", auth.user?.id ?? "")
    .maybeSingle();

  const isAdmin = profile?.role === "admin";
  const displayName = profile ? formatMemberName(profile as MemberNameFields) : "Member";
  const initial = profile?.name_first?.charAt(0).toUpperCase() ?? "?";

  const preferences = auth.user ? await loadMemberPreferences(supabase, auth.user.id) : null;

  // Prefer club_joined_at (member-set); fall back to joined_at (signup).
  const joinedSource: string | null = profile?.club_joined_at ?? profile?.joined_at ?? null;
  const joinedDate = joinedSource ? new Date(joinedSource) : null;

  // club_joined_at is stored as "YYYY-MM-01" — parse month/year for the editor.
  const clubDate: Date | null = profile?.club_joined_at
    ? new Date(profile.club_joined_at)
    : null;
  const currentMonth = clubDate ? clubDate.getUTCMonth() + 1 : null;
  const currentYear = clubDate ? clubDate.getUTCFullYear() : null;

  const joinedLabel = joinedDate
    ? `Member since ${joinedDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })}`
    : null;

  return (
    <main className="mx-auto max-w-md px-5 py-6 pb-24 flex-1">
      {/* Identity card */}
      <header className="mb-6 flex flex-col items-center text-center">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-accent-tint to-accent/30 border border-accent/40 flex items-center justify-center mb-4">
          <span className="font-display text-4xl text-foreground">{initial}</span>
        </div>
        <h1 className="text-4xl">{displayName}</h1>
        {auth.user?.email ? (
          <p className="text-sm text-foreground-muted mt-1">{auth.user.email}</p>
        ) : null}
        <div className="flex flex-col items-center gap-1.5 mt-3">
          {isAdmin ? (
            <span className="text-[10px] uppercase tracking-widest text-accent px-2 py-0.5 rounded-full bg-accent-tint border border-accent/40">
              Admin
            </span>
          ) : null}
          <MemberSinceEditor
            currentLabel={joinedLabel}
            currentMonth={currentMonth}
            currentYear={currentYear}
          />
        </div>
      </header>

      <Divider label="Appearance" />
      <ThemeToggle />

      {preferences ? (
        <>
          <Divider label="Preferences" />
          <Card className="mb-3">
            <PreferencesForm initial={preferences} />
          </Card>
        </>
      ) : null}

      {isAdmin ? (
        <>
          <Divider label="Admin" />
          <Card className="mb-3">
            <Link
              href="/admin/invites"
              className="block text-base text-foreground hover:text-foreground-muted"
            >
              Generate invite link →
            </Link>
            <p className="text-sm text-foreground-subtle mt-1">
              Create a one-shot link to bring a new member in.
            </p>
          </Card>
          <Card>
            <Link
              href="/admin/usage"
              className="block text-base text-foreground hover:text-foreground-muted"
            >
              View usage / costs →
            </Link>
            <p className="text-sm text-foreground-subtle mt-1">
              See API spend across OpenAI and Replicate.
            </p>
          </Card>
        </>
      ) : null}

      <Divider label="Account" />

      <form action={signOut}>
        <Button type="submit" variant="ghost" size="large" className="w-full">
          Sign out
        </Button>
      </form>
    </main>
  );
}
