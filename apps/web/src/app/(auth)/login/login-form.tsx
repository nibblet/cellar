"use client";

import { useActionState } from "react";
import { Button, Card } from "@/components/primitives";
import { requestMagicLink } from "./actions";

type State = { status: "idle" | "sent" | "error"; message?: string };

const initial: State = { status: "idle" };

export function LoginForm() {
  const [state, action, pending] = useActionState(requestMagicLink, initial);

  if (state.status === "sent") {
    return (
      <Card>
        <h2 className="text-xl mb-3">Check your email</h2>
        <p className="text-foreground-muted">
          A sign-in link is on its way. Tap it from the same device to come back here.
        </p>
      </Card>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
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

      {state.status === "error" && (
        <p className="text-sm text-ember-500" role="alert">
          {state.message}
        </p>
      )}

      <Button type="submit" size="large" disabled={pending}>
        {pending ? "Sending…" : "Send sign-in link"}
      </Button>
    </form>
  );
}
