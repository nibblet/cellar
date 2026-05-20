"use client";

import { useActionState } from "react";
import { Button } from "@/components/primitives";
import { type UpdatePasswordState, updatePassword } from "./actions";

const initial: UpdatePasswordState = { status: "idle" };

export function UpdateForm() {
  const [state, action, pending] = useActionState(updatePassword, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <label htmlFor="password" className="flex flex-col gap-2">
        <span className="text-sm tracking-wider uppercase text-foreground-subtle">
          New password
        </span>
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
        {pending ? "Updating…" : "Set new password"}
      </Button>
    </form>
  );
}
