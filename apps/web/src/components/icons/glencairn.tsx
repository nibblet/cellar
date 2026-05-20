import { cn } from "@/lib/utils";

type GlencairnIconProps = {
  /** Full = bourbon-amber fill. Empty = outline only. */
  full?: boolean;
  className?: string;
  size?: number;
};

/**
 * Tulip-shaped Glencairn whiskey glass icon. Filled = recommend, empty = pass.
 * Used in the recommend bar for bourbon products.
 */
export function GlencairnIcon({ full = false, className, size = 28 }: GlencairnIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-hidden="true"
      className={cn(full ? "text-ember-500" : "text-foreground-subtle", className)}
    >
      {/* tulip bowl outline */}
      <path
        d="M11 7 Q9 12 11 18 Q12 22 16 22 Q20 22 21 18 Q23 12 21 7 Z"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        className={full ? "text-foreground-muted" : "text-foreground-subtle"}
      />
      {/* stem + base */}
      <line
        x1="16"
        y1="22"
        x2="16"
        y2="27"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        className={full ? "text-foreground-muted" : "text-foreground-subtle"}
      />
      <line
        x1="11"
        y1="27"
        x2="21"
        y2="27"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        className={full ? "text-foreground-muted" : "text-foreground-subtle"}
      />
      {full ? (
        // amber pour inside the bowl
        <path d="M11.4 13 Q12 21 16 21 Q20 21 20.6 13 Z" fill="currentColor" opacity="0.85" />
      ) : null}
    </svg>
  );
}
