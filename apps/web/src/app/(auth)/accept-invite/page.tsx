import { redirect } from "next/navigation";
import { Winston } from "@/components/brand";
import { AppShell } from "@/components/layout/app-shell";
import { Voice } from "@/components/primitives";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AcceptInviteForm } from "./accept-invite-form";

type SearchParams = Promise<{ token?: string }>;

export default async function AcceptInvitePage({ searchParams }: { searchParams: SearchParams }) {
  const { token } = await searchParams;

  if (!token) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();
  const { data: inviteId, error } = await supabase.rpc("validate_invite_token", {
    token_param: token,
  });

  if (error || !inviteId) {
    return (
      <AppShell auth>
        <header className="text-center mb-8 flex flex-col items-center">
          <Winston variant="splash" size={220} className="mb-4 w-44 h-auto" />
          <h1 className="text-4xl mb-2">NCCC</h1>
        </header>
        <Voice className="text-center">
          "This invitation isn't valid, sir. Perhaps a member can send you a fresh one."
        </Voice>
      </AppShell>
    );
  }

  return (
    <AppShell auth>
      <header className="text-center mb-8 flex flex-col items-center">
        <Winston variant="splash" size={220} className="mb-4 w-44 h-auto" />
        <h1 className="text-4xl mb-2">NCCC</h1>
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">
          Welcome to the club
        </p>
      </header>

      <Voice className="text-center mb-8">
        "A pleasure to have you. Sign in below and your seat will be ready."
      </Voice>

      <AcceptInviteForm token={token} />
    </AppShell>
  );
}
