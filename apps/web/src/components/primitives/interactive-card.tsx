import { cn } from "@/lib/utils";

const interactiveBase = cn(
  "relative overflow-hidden rounded-[16px] border border-border bg-surface",
  "shadow-[0_1px_0_rgba(26,22,19,0.06)]",
  "border-l-2 border-l-transparent",
  "transition-[background,box-shadow,transform,border-color] duration-150",
  "hover:bg-surface-2 hover:shadow-[0_2px_0_rgba(26,22,19,0.08)] hover:border-l-accent",
  "group-hover:bg-surface-2 group-hover:shadow-[0_2px_0_rgba(26,22,19,0.08)] group-hover:border-l-accent",
  "active:scale-[0.99]",
);

/** Tappable link/button tiles — solid surface with brass left edge on hover. */
export const interactiveCardClassName = interactiveBase;

/** Club-validated pairing tiles — moss left border + faint moss tint. */
export const validatedCardClassName = cn(
  interactiveBase,
  "border-l-moss-600/60 bg-gradient-to-br from-surface to-moss-600/5",
  "hover:border-l-moss-600 hover:from-surface hover:to-moss-600/10",
  "group-hover:border-l-moss-600 group-hover:from-surface group-hover:to-moss-600/10",
);

/** Shared focus ring for interactive tile buttons. */
export const cardFocusClassName =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
