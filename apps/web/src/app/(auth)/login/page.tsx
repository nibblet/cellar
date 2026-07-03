import { Winston } from "@/components/brand";
import { AppShell } from "@/components/layout/app-shell";
import { Voice } from "@/components/primitives";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <AppShell auth>
      <header className="text-center mb-8 flex flex-col items-center">
        <Winston variant="splash" size={220} className="mb-4 w-44 h-auto" />
        <h1 className="text-4xl mb-2">NCCC</h1>
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">Your humidor</p>
      </header>

      <Voice className="text-center mb-8">
        "Welcome back. Gas lamps are on, chair's open on the porch."
      </Voice>

      <LoginForm />
    </AppShell>
  );
}
