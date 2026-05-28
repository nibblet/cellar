"use client";

import { startTransition, useState } from "react";
import { setCellarState } from "@/lib/cellar/actions";
import type { CellarRow } from "@/lib/cellar/types";
import { applyPatch } from "@/lib/cellar/types";
import { cn } from "@/lib/utils";

type CellarCardControlsProps = {
  productId: string;
  initialState: CellarRow;
};

/**
 * Compact three-icon control for catalog cards (Cigars / Bourbons feed tabs).
 * Sits at the card's bottom-right, etched-glass treatment.
 * Same optimistic update pattern as CellarToggle.
 */
export function CellarCardControls({ productId, initialState }: CellarCardControlsProps) {
  const [state, setState] = useState<CellarRow>(initialState);

  function toggle(field: keyof CellarRow, e: React.MouseEvent) {
    // Stop the Link parent from navigating to the product page.
    e.preventDefault();
    e.stopPropagation();
    const patch = { [field]: !state[field] };
    const next = applyPatch(state, patch);
    setState(next);
    startTransition(() => {
      setCellarState(productId, patch);
    });
  }

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1.5 rounded-full bg-ink-900/40 border border-paper-50/30 backdrop-blur-[2px]"
      onClick={(e) => e.preventDefault()}
      onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
      role="group"
      aria-label="Cellar status"
    >
      {/* Tried — check mark */}
      <IconButton active={state.tried} label="Tried" onClick={(e) => toggle("tried", e)}>
        <CheckIcon active={state.tried} />
      </IconButton>
      {/* Have — glass / leaf */}
      <IconButton active={state.have} label="Have" onClick={(e) => toggle("have", e)}>
        <HaveIcon active={state.have} />
      </IconButton>
      {/* Want — bookmark */}
      <IconButton active={state.want} label="Want" onClick={(e) => toggle("want", e)}>
        <WantIcon active={state.want} />
      </IconButton>
      {/* Loved — heart, only once tried */}
      {state.tried && (
        <IconButton active={state.loved} label="Love" onClick={(e) => toggle("loved", e)}>
          <HeartIcon active={state.loved} />
        </IconButton>
      )}
    </div>
  );
}

function IconButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "w-8 h-8 flex items-center justify-center rounded-full transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
        active ? "text-accent" : "text-paper-50/70 hover:text-paper-50",
      )}
      title={label}
    >
      {children}
    </button>
  );
}

function CheckIcon({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <circle
        cx="6"
        cy="6"
        r="5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.2 : 0}
      />
      {active && (
        <path
          d="M3.5 6l1.8 1.8 3.2-3.6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

function HaveIcon({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M2 9.5h8M3.5 9.5V6a2.5 2.5 0 015 0v3.5M5 5.5h2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.2 : 0}
      />
    </svg>
  );
}

function HeartIcon({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 13.5S2.5 10 2.5 6.2A2.7 2.7 0 018 4.6a2.7 2.7 0 015.5 1.6C13.5 10 8 13.5 8 13.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.25 : 0}
      />
    </svg>
  );
}

function WantIcon({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M3 2h6v9L6 9.5 3 11V2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.3 : 0}
      />
    </svg>
  );
}
