import { NCCCLogo } from "@/components/brand";
import { Voice } from "@/components/primitives";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-md px-5 py-10 flex-1">
      <header className="text-center mb-8 flex flex-col items-center">
        <NCCCLogo size={120} className="mb-4" decorative />
        <h1 className="text-4xl mb-2">NCCC</h1>
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">Members</p>
      </header>

      <Voice className="text-center mb-8">
        "State your name at the door. I'll have your usual ready."
      </Voice>

      <LoginForm />

      <p className="text-center mt-8 text-sm text-foreground-subtle">
        New to NCCC? You'll need an invite from an existing member.
      </p>
    </main>
  );
}
