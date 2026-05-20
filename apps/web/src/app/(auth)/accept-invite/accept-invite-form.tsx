"use client";

import { useActionState } from "react";
import { Button, Card } from "@/components/primitives";
import { acceptInvite } from "./actions";

type State = { status: "idle" | "sent" | "error"; message?: string };

const initial: State = { status: "idle" };

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvite, initial);

  if (state.status === "sent") {
    return (
      <Card>
        <h2 className="text-xl mb-3">Check your email</h2>
        <p className="text-foreground-muted">
          We've sent your sign-in link. Tap it from the same device to finish joining.
        </p>
      </Card>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />

      <label htmlFor="email" className="flex flex-col gap-2">
        <span className="text-sm tracking-wider uppercase text-foreground-subtle">Email</span>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="h-14 px-4 rounded-[12px] bg-surface border border-border text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </label>

      <label htmlFor="name_first" className="flex flex-col gap-2">
        <span className="text-sm tracking-wider uppercase text-foreground-subtle">First name</span>
        <input
          id="name_first"
          name="name_first"
          type="text"
          required
          autoComplete="given-name"
          maxLength={40}
          className="h-14 px-4 rounded-[12px] bg-surface border border-border text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </label>

      <label htmlFor="name_last_initial" className="flex flex-col gap-2">
        <span className="text-sm tracking-wider uppercase text-foreground-subtle">
          Last initial
        </span>
        <input
          id="name_last_initial"
          name="name_last_initial"
          type="text"
          required
          maxLength={1}
          pattern="[A-Za-z]"
          placeholder="C"
          className="h-14 px-4 rounded-[12px] bg-surface border border-border text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-accent uppercase tracking-widest"
        />
      </label>

      {state.status === "error" && (
        <p className="text-sm text-ember-500" role="alert">
          {state.message}
        </p>
      )}

      <Button type="submit" size="large" disabled={pending}>
        {pending ? "Sending…" : "Join NCCC"}
      </Button>
    </form>
  );
}
