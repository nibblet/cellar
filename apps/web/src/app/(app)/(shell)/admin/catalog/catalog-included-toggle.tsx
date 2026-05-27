"use client";

import { useActionState } from "react";
import { cn } from "@/lib/utils";
import { type SetCatalogIncludedState, setCatalogIncluded } from "./actions";

const initial: SetCatalogIncludedState = { status: "idle" };

type CatalogIncludedToggleProps = {
  productId: string;
  included: boolean;
};

/** Hide a bourbon from member-facing catalog browse, or promote it back. */
export function CatalogIncludedToggle({ productId, included }: CatalogIncludedToggleProps) {
  const [state, action, pending] = useActionState(setCatalogIncluded, initial);

  return (
    <form action={action} className="shrink-0">
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="included" value={included ? "false" : "true"} />
      <button
        type="submit"
        disabled={pending}
        aria-pressed={included}
        aria-label={included ? "Hide from catalog" : "Show in catalog"}
        className={cn(
          "h-8 px-2.5 rounded-full text-[10px] uppercase tracking-widest border transition-colors disabled:opacity-50",
          included
            ? "bg-surface-2 text-foreground-muted border-border hover:text-foreground"
            : "bg-ink-900/40 text-foreground-subtle border-border hover:text-foreground",
        )}
      >
        {pending ? "…" : included ? "In catalog" : "Hidden"}
      </button>
      {state.status === "error" && state.message ? (
        <span className="sr-only">{state.message}</span>
      ) : null}
    </form>
  );
}
