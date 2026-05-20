import { redirect } from "next/navigation";
import { NCCCLogo } from "@/components/brand";
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
      <main className="mx-auto max-w-md px-5 py-10 flex-1">
        <header className="text-center mb-8 flex flex-col items-center">
          <NCCCLogo size={120} className="mb-4" decorative />
          <h1 className="text-4xl mb-2">NCCC</h1>
        </header>
        <Voice className="text-center">
          "This invitation isn't valid, sir. Perhaps a member can send you a fresh one."
        </Voice>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-5 py-10 flex-1">
      <header className="text-center mb-8 flex flex-col items-center">
        <NCCCLogo size={120} className="mb-4" decorative />
        <h1 className="text-4xl mb-2">NCCC</h1>
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">
          Welcome to the club
        </p>
      </header>

      <Voice className="text-center mb-8">
        "A pleasure to have you. Sign in below and your seat will be ready."
      </Voice>

      <AcceptInviteForm token={token} />
    </main>
  );
}
