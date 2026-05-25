import { NCCCLogo } from "@/components/brand";
import { AppShell } from "@/components/layout/app-shell";
import { Voice } from "@/components/primitives";
import { ResetForm } from "./reset-form";

export default function ResetPasswordPage() {
  return (
    <AppShell auth>
      <header className="text-center mb-8 flex flex-col items-center">
        <NCCCLogo size={100} className="mb-4" decorative />
        <h1 className="text-4xl mb-2">NCCC</h1>
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">Reset</p>
      </header>

      <Voice className="text-center mb-8">
        "Forgotten the passphrase? Happens to the best of us, sir."
      </Voice>

      <ResetForm />
    </AppShell>
  );
}
