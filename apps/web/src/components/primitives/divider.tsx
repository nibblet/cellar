import type { ReactNode } from "react";

type DividerProps = {
  label: ReactNode;
};

/**
 * The signature etched section divider. Renders as:
 *   ─────  THE CLUB SAYS  ─────────
 *
 * Used at every major section break across the app.
 */
export function Divider({ label }: DividerProps) {
  return <div className="nccc-divider">{label}</div>;
}
