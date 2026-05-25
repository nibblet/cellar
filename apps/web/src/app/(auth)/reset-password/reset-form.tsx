"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Card } from "@/components/primitives";
import { type ResetPasswordState, requestPasswordReset } from "./actions";

const initial: ResetPasswordState = { status: "idle" };

export function ResetForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initial);

  if (state.status === "sent") {
    return (
      <Card>
        <h2 className="text-xl mb-3">Check your email</h2>
        <p className="text-foreground-muted">
          If that email is registered with NCCC, a reset link is on its way.
        </p>
        <p className="text-sm text-foreground-subtle mt-4">
          <Link href="/login" className="underline hover:text-foreground">
            Back to sign in
          </Link>
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
          className="h-14 px-4 rounded-[12px] bg-surface border border-border text-base text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </label>

      {state.status === "error" && (
        <p className="text-sm text-ember-500" role="alert">
          {state.message}
        </p>
      )}

      <Button type="submit" size="large" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>

      <p className="text-center text-sm">
        <Link href="/login" className="text-foreground-muted hover:text-foreground underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
