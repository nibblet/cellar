import { cn } from "@/lib/utils";

type CigarIconProps = {
  /** Lit = ember tip + faint smoke wisp. Dim = outline only. */
  lit?: boolean;
  className?: string;
  size?: number;
};

/**
 * Hand-drawn-ish cigar icon. Lit state lights the tip with --ember-500 and
 * adds a thin smoke wisp; dim state is pure outline ink.
 *
 * Used in the recommend bar (one icon per member, lit = recommended).
 */
export function CigarIcon({ lit = false, className, size = 28 }: CigarIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-hidden="true"
      className={cn(lit ? "text-ember-500" : "text-foreground-subtle", className)}
    >
      {lit ? (
        <>
          {/* smoke wisp */}
          <path
            d="M5 6 Q4 4 5.5 3 Q7 2 6 0.5"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.55"
            fill="none"
            transform="translate(0 4)"
          />
          {/* lit tip ember (filled) */}
          <circle cx="7" cy="17" r="2.4" fill="currentColor" />
        </>
      ) : (
        <circle cx="7" cy="17" r="2.4" stroke="currentColor" strokeWidth="1.4" fill="none" />
      )}
      {/* cigar body */}
      <rect
        x="9"
        y="14"
        width="20"
        height="6"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.4"
        fill={lit ? "rgba(0,0,0,0)" : "none"}
        className={lit ? "text-foreground-muted" : "text-foreground-subtle"}
      />
      {/* band */}
      <rect
        x="22"
        y="14"
        width="4"
        height="6"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        className={lit ? "text-foreground-muted" : "text-foreground-subtle"}
      />
    </svg>
  );
}
