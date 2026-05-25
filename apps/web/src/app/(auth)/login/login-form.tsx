"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/primitives";
import { type LoginState, signInWithPassword } from "./actions";

const initial: LoginState = { status: "idle" };

export function LoginForm() {
  const [state, action, pending] = useActionState(signInWithPassword, initial);

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

      <label htmlFor="password" className="flex flex-col gap-2">
        <span className="text-sm tracking-wider uppercase text-foreground-subtle">Password</span>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="h-14 px-4 rounded-[12px] bg-surface border border-border text-base text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </label>

      {state.status === "error" && (
        <p className="text-sm text-ember-500" role="alert">
          {state.message}
        </p>
      )}

      <Button type="submit" size="large" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-center text-sm">
        <Link
          href="/reset-password"
          className="text-foreground-muted hover:text-foreground underline"
        >
          Forgot password?
        </Link>
      </p>
    </form>
  );
}
