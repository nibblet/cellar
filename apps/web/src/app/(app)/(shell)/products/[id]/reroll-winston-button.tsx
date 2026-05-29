"use client";

import { useActionState } from "react";
import { rerollWinstonProse, type RerollState } from "./reroll-actions";

const INITIAL: RerollState = { status: "idle" };

export function RerollWinstonButton({ productId }: { productId: string }) {
  const [state, formAction, pending] = useActionState(rerollWinstonProse, INITIAL);

  return (
    <form action={formAction} className="mt-2 flex items-center gap-2">
      <input type="hidden" name="product_id" value={productId} />
      <button
        type="submit"
        disabled={pending}
        className="text-[11px] uppercase tracking-widest text-foreground-subtle hover:text-foreground border border-border rounded-full px-2.5 py-1 disabled:opacity-50"
      >
        {pending ? "Clearing…" : "Re-roll Winston"}
      </button>
      {state.status === "ok" ? (
        <span className="text-[11px] text-foreground-subtle">{state.message}</span>
      ) : null}
      {state.status === "error" ? (
        <span className="text-[11px] text-ember-500">{state.message}</span>
      ) : null}
    </form>
  );
}
