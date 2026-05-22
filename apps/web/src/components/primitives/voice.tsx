import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type VoiceProps = {
  children: ReactNode;
  className?: string;
};

/**
 * The Bartender's voice. Fraunces upright serif — distinctive but readable
 * at body size. Used for empty states, recommendation intros, system messages,
 * and end-of-night recaps.
 *
 * Italic is reserved for short garnish lines (photo credits, one-liners).
 * Prose always uses roman weight so it stays legible on dark backgrounds.
 */
export function Voice({ children, className }: VoiceProps) {
  return <p className={cn("nccc-voice", className)}>{children}</p>;
}
