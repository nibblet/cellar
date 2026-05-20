import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
};

export function Chip({ selected = false, className, ...props }: ChipProps) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex items-center px-3 py-1.5 rounded-full text-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        selected
          ? "bg-accent-tint text-foreground border border-accent"
          : "bg-surface text-foreground-muted border border-border hover:bg-surface-2",
        className,
      )}
    />
  );
}
