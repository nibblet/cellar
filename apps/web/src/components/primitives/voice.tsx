import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type VoiceProps = {
  children: ReactNode;
  className?: string;
};

/**
 * The Bartender's voice. Italic serif (Playfair). Used for empty states,
 * recommendation intros, system messages, and end-of-night recaps.
 *
 * Italic Playfair is HOW users know it's him without an avatar.
 */
export function Voice({ children, className }: VoiceProps) {
  return <p className={cn("nccc-voice", className)}>{children}</p>;
}
