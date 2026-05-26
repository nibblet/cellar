"use client";

import { useActionState } from "react";
import { isCollapseFlagged } from "@/lib/catalog/collapse-groups";
import { cn } from "@/lib/utils";
import { type SetCollapseFlagState, setCollapseFlag } from "./actions";

const initial: SetCollapseFlagState = { status: "idle" };

type CollapseFlagToggleProps = {
  productId: string;
  specs: Record<string, unknown> | null;
  className?: string;
};

export function CollapseFlagToggle({ productId, specs, className }: CollapseFlagToggleProps) {
  const flagged = isCollapseFlagged({ specs });
  const [state, action, pending] = useActionState(setCollapseFlag, initial);

  return (
    <form action={action} className={cn("shrink-0", className)}>
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="collapse" value={flagged ? "N" : "Y"} />
      <button
        type="submit"
        disabled={pending}
        aria-pressed={flagged}
        aria-label={flagged ? "Remove collapse flag" : "Flag for collapse"}
        className={cn(
          "h-8 px-2.5 rounded-full text-[10px] uppercase tracking-widest border transition-colors disabled:opacity-50",
          flagged
            ? "bg-moss-600/15 text-moss-600 border-moss-600/30 hover:bg-moss-600/25"
            : "bg-surface-2 text-foreground-subtle border-border hover:text-foreground",
        )}
      >
        {pending ? "…" : flagged ? "Collapse Y" : "Collapse N"}
      </button>
      {state.status === "error" && state.message ? (
        <span className="sr-only">{state.message}</span>
      ) : null}
    </form>
  );
}
