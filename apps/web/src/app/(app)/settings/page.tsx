import Link from "next/link";
import { Button, Card, Divider } from "@/components/primitives";
import { ThemeToggle } from "@/components/theme";
import { formatMemberName, type MemberNameFields } from "@/lib/identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("name_first, name_last_initial, role, joined_at")
    .eq("id", auth.user?.id ?? "")
    .maybeSingle();

  const isAdmin = profile?.role === "admin";
  const displayName = profile ? formatMemberName(profile as MemberNameFields) : "Member";
  const initial = profile?.name_first?.charAt(0).toUpperCase() ?? "?";

  // Member-since label (e.g. "Member since May 2026")
  const joinedLabel = profile?.joined_at
    ? `Member since ${new Date(profile.joined_at).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })}`
    : null;

  return (
    <main className="mx-auto max-w-md px-5 py-6 pb-24 flex-1">
      {/* Hero — avatar + name + email + role, big enough to feel like an
          identity card rather than a settings header. */}
      <header className="mb-6 flex flex-col items-center text-center">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-accent-tint to-accent/30 border border-accent/40 flex items-center justify-center mb-4">
          <span className="font-display text-4xl text-foreground">{initial}</span>
        </div>
        <h1 className="text-4xl">{displayName}</h1>
        {auth.user?.email ? (
          <p className="text-sm text-foreground-muted mt-1">{auth.user.email}</p>
        ) : null}
        <div className="flex items-center gap-2 mt-3">
          {isAdmin ? (
            <span className="text-[10px] uppercase tracking-widest text-accent px-2 py-0.5 rounded-full bg-accent-tint border border-accent/40">
              Admin
            </span>
          ) : null}
          {joinedLabel ? (
            <span className="text-[11px] text-foreground-subtle">{joinedLabel}</span>
          ) : null}
        </div>
      </header>

      <Divider label="Club" />
      <Card className="mb-3">
        <Link
          href="/events"
          className="block text-base text-foreground hover:text-foreground-muted"
        >
          Meetups →
        </Link>
        <p className="text-sm text-foreground-subtle mt-1">
          The calendar of NCCC nights, past and upcoming.
        </p>
      </Card>

      <Divider label="Appearance" />
      <ThemeToggle />

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
