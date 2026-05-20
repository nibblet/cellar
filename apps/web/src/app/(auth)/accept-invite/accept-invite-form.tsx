"use client";

import { useActionState } from "react";
import { Button, Card } from "@/components/primitives";
import { type AcceptInviteState, acceptInvite } from "./actions";

const initial: AcceptInviteState = { status: "idle" };

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvite, initial);

  if (state.status === "sent") {
    return (
      <Card>
        <h2 className="text-xl mb-3">Check your email</h2>
        <p className="text-foreground-muted">
          A confirmation link is on its way. Tap it from the same device to finish joining.
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

      <label htmlFor="password" className="flex flex-col gap-2">
        <span className="text-sm tracking-wider uppercase text-foreground-subtle">Password</span>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          className="h-14 px-4 rounded-[12px] bg-surface border border-border text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </label>

      <label htmlFor="password_confirm" className="flex flex-col gap-2">
        <span className="text-sm tracking-wider uppercase text-foreground-subtle">
          Confirm password
        </span>
        <input
          id="password_confirm"
          name="password_confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="h-14 px-4 rounded-[12px] bg-surface border border-border text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </label>

      {state.status === "error" && (
        <p className="text-sm text-ember-500" role="alert">
          {state.message}
        </p>
      )}

      <Button type="submit" size="large" disabled={pending}>
        {pending ? "Joining…" : "Join NCCC"}
      </Button>
    </form>
  );
}
