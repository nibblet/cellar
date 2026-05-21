import { cn } from "@/lib/utils";

type SpinnerProps = {
  className?: string;
  label?: string;
};

export function Spinner({ className, label = "Loading" }: SpinnerProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-3", className)}
      role="status"
      aria-label={label}
    >
      <div
        className="h-8 w-8 rounded-full border-2 border-border border-t-accent animate-spin"
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
