"use client";

import { useActionState } from "react";
import { Button } from "@/components/primitives";
import { type DisplayNameFormState, updateDisplayName } from "./actions";

const INITIAL: DisplayNameFormState = { ok: false, message: null };

export function DisplayNameForm({
  initialFirst,
  initialInitial,
}: {
  initialFirst: string;
  initialInitial: string;
}) {
  const [state, formAction, pending] = useActionState(updateDisplayName, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-widest text-foreground-subtle">
          First name
        </span>
        <input
          name="name_first"
          defaultValue={initialFirst}
          required
          maxLength={40}
          className="rounded-[8px] border border-border bg-surface px-3 py-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-widest text-foreground-subtle">
          Last initial
        </span>
        <input
          name="name_last_initial"
          defaultValue={initialInitial}
          maxLength={1}
          className="w-16 rounded-[8px] border border-border bg-surface px-3 py-2 text-base text-foreground uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save name"}
        </Button>
        {state.message ? (
          <span className={state.ok ? "text-sm text-moss-600" : "text-sm text-ember-500"}>
            {state.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
