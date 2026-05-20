import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={cn(
        "bg-surface border border-border rounded-[16px] p-4",
        "shadow-[0_1px_0_rgba(26,22,19,0.06)]",
        className,
      )}
    />
  );
}
