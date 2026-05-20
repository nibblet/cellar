import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "default" | "large";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-accent text-ink-900 hover:bg-accent-hover active:bg-accent-hover font-medium",
  secondary: "bg-surface text-foreground-muted border border-border hover:bg-surface-2",
  ghost: "bg-transparent text-foreground-muted hover:bg-surface",
};

const sizeStyles: Record<ButtonSize, string> = {
  default: "h-12 px-5 text-base",
  large: "h-14 px-6 text-base",
};

export function Button({
  variant = "primary",
  size = "default",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[12px] transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
    />
  );
}
