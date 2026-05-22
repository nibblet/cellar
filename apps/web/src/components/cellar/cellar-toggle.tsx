"use client";

import { startTransition, useState } from "react";
import { setCellarState } from "@/lib/cellar/actions";
import type { CellarRow } from "@/lib/cellar/types";
import { applyPatch } from "@/lib/cellar/types";
import { cn } from "@/lib/utils";

type CellarToggleProps = {
  productId: string;
  initialState: CellarRow;
};

/**
 * Three-pill Tried / Have / Want toggle row for the product detail page.
 * Optimistic: local state updates immediately; server action fires in background.
 * Active pills use brass tint. Have and Want are mutually exclusive; Have implies Tried.
 */
export function CellarToggle({ productId, initialState }: CellarToggleProps) {
  const [state, setState] = useState<CellarRow>(initialState);

  function toggle(field: keyof CellarRow) {
    const patch = { [field]: !state[field] };
    const next = applyPatch(state, patch);
    setState(next);
    startTransition(() => {
      setCellarState(productId, patch);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <PillButton active={state.tried} onClick={() => toggle("tried")}>
        Tried
      </PillButton>
      <PillButton active={state.have} onClick={() => toggle("have")}>
        Have
      </PillButton>
      <PillButton active={state.want} onClick={() => toggle("want")}>
        Want
      </PillButton>
    </div>
  );
}

function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center px-3 py-1 rounded-full text-[12px] tracking-wide transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        active
          ? "bg-accent-tint text-foreground border border-accent"
          : "bg-surface text-foreground-muted border border-border hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}
