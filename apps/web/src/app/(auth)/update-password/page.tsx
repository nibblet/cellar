import { redirect } from "next/navigation";
import { NCCCLogo } from "@/components/brand";
import { AppShell } from "@/components/layout/app-shell";
import { Voice } from "@/components/primitives";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UpdateForm } from "./update-form";

export default async function UpdatePasswordPage() {
  // The recovery flow exchanges the code for a session at /auth/callback,
  // then redirects here. If the user lands here cold (no session), bounce
  // them back to the reset request page.
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect("/reset-password");
  }

  return (
    <AppShell auth>
      <header className="text-center mb-8 flex flex-col items-center">
        <NCCCLogo size={100} className="mb-4" decorative />
        <h1 className="text-4xl mb-2">NCCC</h1>
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">New passphrase</p>
      </header>

      <Voice className="text-center mb-8">
        "A fresh one, sir. Choose something you'll remember."
      </Voice>

      <UpdateForm />
    </AppShell>
  );
}
