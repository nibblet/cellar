import Link from "next/link";
import { Button, Card, Divider } from "@/components/primitives";
import { formatMemberName } from "@/lib/identity";
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

  return (
    <main className="mx-auto max-w-md px-5 py-6 pb-24 flex-1">
      <header className="mb-6">
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">You</p>
        <h1 className="text-3xl mt-1">{profile ? formatMemberName(profile) : "Settings"}</h1>
        <p className="text-sm text-foreground-muted mt-1">{auth.user?.email}</p>
      </header>

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
